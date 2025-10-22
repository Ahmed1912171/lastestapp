import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mysql from "mysql2/promise";
import fetch from "node-fetch";
import OpenAI from "openai";

// ==========================
// ✅ SETUP
// ==========================
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// ==========================
// ✅ ENV + CONFIG LOGS
// ==========================
console.log("🌍 Environment loaded");
console.log(
  "🔑 OPENAI_API_KEY:",
  process.env.OPENAI_API_KEY ? "Found ✅" : "❌ Missing"
);

// ==========================
// ✅ MYSQL CONNECTION
// ==========================
let db;
async function initDb() {
  try {
    db = await mysql.createConnection({
      host: "192.168.1.130",
      user: "labintegration",
      password: "chkefro",
      database: "convert_april_k5",
      connectTimeout: 10000,
    });
    console.log("✅ Connected to MySQL");
  } catch (err) {
    console.error("❌ DB Connection Failed:", err.message);
    process.exit(1);
  }
}
await initDb();

// ==========================
// ✅ OPENAI INIT
// ==========================
let openai;
try {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  console.log("🧠 OpenAI initialized");
} catch (err) {
  console.error("❌ Failed to initialize OpenAI:", err.message);
}

// ==========================
// ✅ SAFE ROUTE WRAPPER
// ==========================
const safeHandler = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error("🔥 Route Error:", err);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: err.message });
  }
};

// ==========================
// 🌐 HEALTH CHECK
// ==========================
app.get(
  "/",
  safeHandler(async (req, res) => {
    res.json({ status: "✅ Server running", time: new Date().toISOString() });
  })
);

// ==========================
// 🔑 LOGIN ENDPOINTS
// ==========================
app.get(
  "/admin",
  safeHandler(async (req, res) => {
    const [results] = await db.query(
      "SELECT ADMIN_ID, GR_EMPLOYER_LOGIN FROM admin"
    );
    res.json(results);
  })
);

app.post(
  "/login",
  safeHandler(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "Missing credentials" });

    const [results] = await db.query(
      "SELECT ADMIN_ID, GR_EMPLOYER_LOGIN FROM admin_users WHERE ADMIN_ID = ? AND GR_EMPLOYER_LOGIN = ? LIMIT 1",
      [username, password]
    );

    if (results.length > 0) res.json({ success: true, user: results[0] });
    else res.status(401).json({ success: false, error: "Invalid credentials" });
  })
);

// ==========================
// 🔍 SEARCH ENDPOINT
// ==========================
app.get(
  "/search",
  safeHandler(async (req, res) => {
    const query = req.query.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    if (!query) return res.status(400).json({ error: "Query is required" });

    const offset = (page - 1) * limit;
    const [results] = await db.query(
      `SELECT PATIENT_ID, PMR_NO, PATIENT_FNAME, GENDER, DISTRICT, DOB, MOBILE_NO,
            TIMESTAMPDIFF(YEAR, DOB, CURDATE()) AS AGE
     FROM prg_patient_reg
     WHERE PATIENT_ID LIKE ? OR PATIENT_FNAME LIKE ?
     LIMIT ? OFFSET ?`,
      [`%${query}%`, `%${query}%`, limit, offset]
    );
    res.json(results);
  })
);

// ==========================
// 🔹 PATIENT ENDPOINTS
// ==========================
app.get(
  "/patients_all",
  safeHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const ward = req.query.ward || "";
    const branch = req.query.branch || "";
    const offset = (page - 1) * limit;

    let sql = `
    SELECT ar.*, pr.PATIENT_ID, pr.PATIENT_FNAME, pr.PATIENT_LNAME,
           pr.GENDER, pr.PHONE_NO, pr.DATE_REG, pr.REGISTER_BY, 
           pr.DISTRICT, pr.CITY, pr.DOB, pr.CNIC, pr.STREET, 
           pr.TEMP_STATUS, pr.MOBILE_NO, pr.FATHER_HUSBAND, pr.PMR_NO,
           TIMESTAMPDIFF(YEAR, pr.DOB, CURDATE()) AS AGE
    FROM adm_requests ar
    LEFT JOIN prg_patient_reg pr ON ar.PATIENT_ID = pr.PATIENT_ID
    WHERE ar.status = 1
  `;
    const params = [];

    if (search) {
      sql +=
        " AND (pr.PATIENT_FNAME LIKE ? OR pr.PATIENT_LNAME LIKE ? OR pr.PMR_NO LIKE ? OR pr.PATIENT_ID LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    if (ward) {
      sql += " AND ar.WARD_ID = ?";
      params.push(ward);
    }
    if (branch && branch.toLowerCase() !== "korangi") return res.json([]);

    sql += " ORDER BY pr.PATIENT_ID DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [results] = await db.query(sql, params);
    res.json(results);
  })
);

app.get(
  "/patients/:id",
  safeHandler(async (req, res) => {
    const [results] = await db.query(
      "SELECT PATIENT_ID, PATIENT_FNAME, GENDER, DISTRICT, DOB, MOBILE_NO, TIMESTAMPDIFF(YEAR, DOB, CURDATE()) AS AGE FROM prg_patient_reg WHERE PATIENT_ID = ?",
      [req.params.id]
    );
    if (!results.length)
      return res.status(404).json({ error: "Patient not found" });
    res.json(results[0]);
  })
);

// ==========================
// 🔹 PATIENT NOTES
// ==========================
app.get(
  "/patients/:id/notes",
  safeHandler(async (req, res) => {
    const [results] = await db.query(
      `SELECT Loc_ID, PATIENT_ID, COALESCE(LocalExamination, '') AS LocalExamination,
            DATE_FORMAT(loc_ex_date, '%Y-%m-%d %H:%i:%s') AS loc_ex_date,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
     FROM opd_local_examination
     WHERE PATIENT_ID = ?
     ORDER BY Loc_ID DESC`,
      [req.params.id]
    );
    res.json(results);
  })
);

app.post(
  "/patients/:id/notes",
  safeHandler(async (req, res) => {
    const { LocalExamination } = req.body;
    if (!LocalExamination)
      return res.status(400).json({ error: "LocalExamination required" });

    const [result] = await db.query(
      "INSERT INTO opd_local_examination (PATIENT_ID, LocalExamination, loc_ex_date) VALUES (?, ?, NOW())",
      [req.params.id, LocalExamination]
    );
    res.json({ success: true, insertId: result.insertId });
  })
);

// ==========================
// 🔹 LAB & RADIOLOGY
// ==========================
app.get(
  "/patients/:id/lab",
  safeHandler(async (req, res) => {
    const [results] = await db.query(
      `
      SELECT 
        o.Patient_ID, 
        o.Order_Id, 
        d.Barcode_no, 

        -- From a_detailresultentry
        r.id, 
        r.LabNo, 
        r.TestID, 
        r.ComponentID,
        r.Result, 
        r.NormalRange, 
        r.Result_date_time,

        -- From a_subdetailresultentry_culture
        c.TestID AS Culture_TestID,
        c.Result_date_time AS Culture_Result_date_time,
        c.TypeofSpecimen, 
        c.growth_type, 
        c.Puss_cell, 
        c.Gram_stain, 
        c.Wet_Mount, 
        c.Culture,

        -- ✅ From a_test (test info)
        t.TestTitle,
        t.Unit

      FROM a_ordering o
      LEFT JOIN a_order_detail d 
        ON o.Order_Id = d.Order_Id
      LEFT JOIN a_detailresultentry r 
        ON d.Barcode_no = r.Barcode_no
      LEFT JOIN a_subdetailresultentry_culture c 
        ON d.Barcode_no = c.Barcode_no
      LEFT JOIN a_test t 
        ON (r.TestID = t.TestID OR c.TestID = t.TestID)  -- ✅ match from either table

      WHERE o.Patient_ID = ?
      ORDER BY r.Result_date_time DESC
      LIMIT 500
      `,
      [req.params.id]
    );

    res.json(results);
  })
);

app.get(
  "/patients/:id/radiology",
  safeHandler(async (req, res) => {
    const [results] = await db.query(
      `SELECT id, pmr_no, status, xray_status, ct_status, request_time,
            Priority AS priority, \`mod\` AS modality, mod_type, mod_region, short_history
     FROM tr_newris_request
     WHERE PATIENT_ID = ?
     ORDER BY id DESC`,
      [req.params.id]
    );
    res.json(results);
  })
);

// ==========================
// 🔹 AI CHAT + LAB ANALYSIS
// ==========================
app.post(
  "/chat",
  safeHandler(async (req, res) => {
    const { messages } = req.body;
    if (!messages) return res.status(400).json({ error: "Missing messages" });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: "gpt-4o-mini", messages }),
    });

    const data = await response.json();
    res.json(data);
  })
);

app.post(
  "/analyze-lab",
  safeHandler(async (req, res) => {
    const { patientId } = req.body;
    if (!patientId)
      return res.status(400).json({ error: "patientId required" });

    const [labResults] = await db.query(
      `SELECT r.TestID, r.Result, r.NormalRange
     FROM a_ordering o
     LEFT JOIN a_order_detail d ON o.Order_Id = d.Order_Id
     LEFT JOIN a_detailresultentry r ON d.Barcode_no = r.Barcode_no
     WHERE o.Patient_ID = ?
     ORDER BY r.Result_date_time DESC
     LIMIT 100`,
      [patientId]
    );

    if (!labResults.length)
      return res.json({ analysis: "No lab results found", labResults });

    const labText = labResults
      .map((r) => `${r.TestID}: ${r.Result} (Normal: ${r.NormalRange})`)
      .join("\n");
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a medical assistant. Summarize abnormal lab results and provide insights.",
        },
        { role: "user", content: labText },
      ],
    });

    res.json({ analysis: response.choices[0].message.content, labResults });
  })
);

// ==========================
// 🔹 WARD BEDS + COUNT
// ==========================
app.get(
  "/ward_beds",
  safeHandler(async (req, res) => {
    const [results] = await db.query(
      "SELECT WARD_ID, WD_OCC_STATUS FROM ward_beds WHERE WARD_ID IN (921,1116,1119)"
    );
    const wardMapping = { 921: "PICU", 1116: "NICU", 1119: "GP" };
    res.json(
      results.map((r) => ({
        ward: wardMapping[r.WARD_ID] || r.WARD_ID,
        status: r.WD_OCC_STATUS,
      }))
    );
  })
);

app.get(
  "/tr_newris_request/count",
  safeHandler(async (req, res) => {
    const [results] = await db.query(
      "SELECT COUNT(*) AS total_count FROM tr_newris_request"
    );
    res.json(results[0]);
  })
);

/////////////// AI Analysis

app.get(
  "/patients/:id/full-analysis",
  safeHandler(async (req, res) => {
    const patientId = req.params.id;

    // 1️⃣ Fetch patient demographics
    const [patientData] = await db.query(
      `SELECT PATIENT_ID, PATIENT_FNAME, PATIENT_LNAME, GENDER, DOB, TIMESTAMPDIFF(YEAR, DOB, CURDATE()) AS AGE, MOBILE_NO, DISTRICT
       FROM prg_patient_reg
       WHERE PATIENT_ID = ?`,
      [patientId]
    );

    if (!patientData.length)
      return res.status(404).json({ error: "Patient not found" });

    const patient = patientData[0];

    // 2️⃣ Fetch lab results
    const [labResults] = await db.query(
      `SELECT r.TestID, r.Result, r.NormalRange, t.TestTitle
       FROM a_ordering o
       LEFT JOIN a_order_detail d ON o.Order_Id = d.Order_Id
       LEFT JOIN a_detailresultentry r ON d.Barcode_no = r.Barcode_no
       LEFT JOIN a_test t ON r.TestID = t.TestID
       WHERE o.Patient_ID = ?
       ORDER BY r.Result_date_time DESC
       LIMIT 100`,
      [patientId]
    );

    // 3️⃣ Fetch radiology results
    const [radiologyResults] = await db.query(
      `SELECT id, pmr_no, status, xray_status, ct_status, request_time,\`mod\`AS modality, mod_type, mod_region, short_history
       FROM tr_newris_request
       WHERE PATIENT_ID = ?
       ORDER BY id DESC`,
      [patientId]
    );

    // 4️⃣ Prepare lab summary for AI
    const labText = labResults
      .map(
        (r) =>
          `${r.TestTitle || r.TestID}: ${r.Result} (Normal: ${r.NormalRange})`
      )
      .join("\n");

    // 5️⃣ Generate AI doctor analysis
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an experienced doctor. Analyze patient lab results and radiology. Provide a concise medical summary and highlight abnormalities.",
        },
        {
          role: "user",
          content: `Patient Info:
- Name: ${patient.PATIENT_FNAME} ${patient.PATIENT_LNAME}
- Age: ${patient.AGE}
- Gender: ${patient.GENDER}
- District: ${patient.DISTRICT}
- Mobile: ${patient.MOBILE_NO}

Lab Results:
${labText}

Radiology Reports:
${radiologyResults.length ? JSON.stringify(radiologyResults, null, 2) : "No radiology reports."}

Provide a professional medical analysis.`,
        },
      ],
    });

    const analysis = response.choices[0].message.content;

    // 6️⃣ Return combined response
    res.json({
      patient,
      labResults,
      radiologyResults,
      analysis,
    });
  })
);

//===============================
// PHARMACY
//===============================

app.get(
  "/tr_pharmacy_store_request",
  safeHandler(async (req, res) => {
    const patientId = req.query.patientId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // ✅ Validate input
    if (!patientId) {
      return res.status(400).json({ error: "Missing patientId" });
    }

    // ✅ Proper JOIN to get medicine name
    const [results] = await db.query(
      `
  SELECT 
    tpsr.*, 
    tsic.SUB_ITEM_CAT AS medicine_name,
    CAST(tpsr.stop_medicine AS UNSIGNED) AS stop_medicine
  FROM tr_pharmacy_store_request tpsr
  LEFT JOIN tr_sub_item_categ tsic 
    ON tpsr.SUB_ITEM_CAT_ID = tsic.SUB_ITEM_CAT_ID
  WHERE tpsr.PATIENT_ID = ?
  ORDER BY tpsr.QUAN_ID DESC
  LIMIT ? OFFSET ?
  `,
      [patientId, limit, offset]
    );

    res.json(results);
  })
);

////////////// MEDICINE NAME
app.get(
  "/medicines",
  safeHandler(async (req, res) => {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // ✅ Query base
    let sql = `
      SELECT SUB_ITEM_CAT_ID, SUB_ITEM_CAT
      FROM tr_sub_item_categ
      WHERE SUB_ITEM_CAT_ID > 100001
        AND SUB_CAT_ID = 2
    `;
    const params = [];

    // 🔍 Search by medicine name
    if (search) {
      sql += " AND SUB_ITEM_CAT LIKE ?";
      params.push(`%${search}%`);
    }

    // ✅ Add ordering + pagination
    sql += " ORDER BY SUB_ITEM_CAT ASC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    // Execute query
    const [results] = await db.query(sql, params);

    // ✅ Get total count for pagination
    const [[{ total }]] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM tr_sub_item_categ
      WHERE SUB_ITEM_CAT_ID > 100001
        AND SUB_CAT_ID = 2
        ${search ? "AND SUB_ITEM_CAT LIKE ?" : ""}
      `,
      search ? [`%${search}%`] : []
    );

    // ✅ Respond
    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      results,
    });
  })
);

// ==========================
// ✅ GLOBAL ERROR HANDLER
// ==========================
app.use((err, req, res, next) => {
  console.error("🔥 Uncaught Error:", err);
  res
    .status(500)
    .json({ error: "Internal Server Error", details: err.message });
});

// ==========================
// ✅ START SERVER
// ==========================
const PORT = 3000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`)
);
