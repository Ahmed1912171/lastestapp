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
// ✅ BRANCH -> DATABASE MAP
// ==========================
const branchDBMap = {
  ho: "convert_april_HO",
  azambasti: "convert_april_azambasti",
  chs: "convert_april_chs",
  jamshoro: "convert_april_jamshoro",
  korangi: "convert_april_k5",
  larkana: "convert_april_larkana",
  sba: "convert_april_sba",
  sobhraj: "convert_april_sobhraj",
};

// ==========================
// ✅ DB CONNECTION CACHE + GETTER
// ==========================
const dbConnections = {};

async function getDb(branch) {
  const dbKey = (branch || "korangi").toString().toLowerCase();
  const dbName = branchDBMap[dbKey] || branchDBMap["korangi"];

  if (dbConnections[dbName]) {
    try {
      // quick ping to validate connection
      await dbConnections[dbName].query("SELECT 1");
      return dbConnections[dbName];
    } catch (err) {
      // connection might be stale - close and reconnect
      try {
        await dbConnections[dbName].end();
      } catch (e) {
        /* ignore */
      }
      delete dbConnections[dbName];
    }
  }

  try {
    const connection = await mysql.createConnection({
      host: "192.168.1.130",
      user: "labintegration",
      password: "chkefro",
      database: dbName,
      connectTimeout: 10000,
    });
    dbConnections[dbName] = connection;
    console.log(`✅ Connected to MySQL database: ${dbName}`);
    return connection;
  } catch (err) {
    console.error(`❌ DB Connection Failed for ${dbName}:`, err.message);
    throw err;
  }
}

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
    // default branch korangi (or pass branch via query to check other DBs)
    const branch = req.query.branch || "korangi";
    const db = await getDb(branch);
    const [results] = await db.query(
      "SELECT ADMIN_ID, GR_EMPLOYER_LOGIN FROM admin"
    );
    res.json(results);
  })
);

app.post(
  "/login",
  safeHandler(async (req, res) => {
    const branch = req.body.branch || req.query.branch || "korangi";
    const db = await getDb(branch);

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
    const branch = req.query.branch || "korangi";
    const db = await getDb(branch);

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
    const branch = req.query.branch || "korangi";
    const offset = (page - 1) * limit;

    // 🔹 Get correct DB for the branch
    const db = await getDb(branch);

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
      // Search by first name, last name, PMR number, patient ID, or ward name
      whereParts.push(`
    (
      pr.PATIENT_FNAME LIKE ?
      OR pr.PATIENT_LNAME LIKE ?
      OR pr.PMR_NO LIKE ?
      OR pr.PATIENT_ID LIKE ?
      OR w.WARD_NAME LIKE ?
    )
  `);
      const term = `%${search}%`;
      paramsCount.push(term, term, term, term, term);
    }

    if (ward) {
      sql += " AND ar.WARD_ID = ?";
      params.push(ward);
    }

    sql += " ORDER BY pr.PATIENT_ID DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [results] = await db.query(sql, params);
    res.json(results);
  })
);

app.get(
  "/patients/:id",
  safeHandler(async (req, res) => {
    const branch = req.query.branch || "korangi";
    const db = await getDb(branch);

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
    const branch = req.query.branch || "korangi";
    const db = await getDb(branch);

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
    const branch = req.body.branch || req.query.branch || "korangi";
    const db = await getDb(branch);

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
    const branch = req.query.branch || "korangi";
    const db = await getDb(branch);

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
    const branch = req.query.branch || "korangi";
    const db = await getDb(branch);

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
    const branch = req.body.branch || req.query.branch || "korangi";
    const db = await getDb(branch);

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
    // 1️⃣ Branch (default korangi)
    const branch = req.query.branch || "korangi";
    const db = await getDb(branch);

    // 2️⃣ Get all wards that should appear in the mobile app
    const [wards] = await db.query(
      `SELECT WARD_ID, WARD_NAME 
       FROM ward 
       WHERE mobile_app = 1`
    );

    if (wards.length === 0) {
      return res.json([]); // no wards found
    }

    // 3️⃣ Get occupancy for those wards
    const wardIds = wards.map((w) => w.WARD_ID);
    const [beds] = await db.query(
      `SELECT WARD_ID, WD_OCC_STATUS 
       FROM ward_beds 
       WHERE WARD_ID IN (${wardIds.join(",")})`
    );

    // 4️⃣ Merge data: attach bed statuses to ward names
    const data = beds.map((b) => {
      const ward = wards.find((w) => w.WARD_ID === b.WARD_ID);
      return {
        ward_id: b.WARD_ID,
        ward_name: ward ? ward.WARD_NAME : "Unknown",
        status: b.WD_OCC_STATUS,
      };
    });

    // 5️⃣ Return final JSON
    res.json(data);
  })
);

app.get(
  "/tr_newris_request/count",
  safeHandler(async (req, res) => {
    const branch = req.query.branch || "korangi";
    const db = await getDb(branch);

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
    const branch = req.query.branch || "korangi";
    const db = await getDb(branch);

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
    const branch = req.query.branch || "korangi";
    const db = await getDb(branch);

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
    const branch = req.query.branch || "korangi";
    const db = await getDb(branch);

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
// ✅ OPTIONAL: CHECK ALL DBS HEALTH
// ==========================
app.get(
  "/check-dbs",
  safeHandler(async (req, res) => {
    const results = [];
    for (const [key, dbName] of Object.entries(branchDBMap)) {
      try {
        const db = await getDb(key);
        const [r] = await db.query(
          "SELECT COUNT(*) AS total FROM prg_patient_reg LIMIT 1"
        );
        results.push({ branch: key, db: dbName, ok: true, sample: r[0] });
      } catch (e) {
        results.push({ branch: key, db: dbName, ok: false, error: e.message });
      }
    }
    res.json(results);
  })
);

////////////////////////////// for all branches and wards

app.get(
  "/all_branch_wards",
  safeHandler(async (req, res) => {
    const branchDBMap = {
      korangi: "convert_april_k5",
      azambasti: "convert_april_azambasti",
      chs: "convert_april_chs",
      jamshoro: "convert_april_jamshoro",
      larkana: "convert_april_larkana",
      sba: "convert_april_sba",
      sobhraj: "convert_april_sobhraj",
    };

    const results = {};

    for (const [branch, dbName] of Object.entries(branchDBMap)) {
      try {
        const db = await getDb(branch);
        // ✅ Fetch only wards where app_mobile = 1
        const [wards] = await db.query(`
        SELECT DISTINCT ward_name 
        FROM ward 
        WHERE mobile_app = 1 
          AND ward_name IS NOT NULL 
          AND ward_name != ''
      `);

        results[branch] = wards.map((w) => w.ward_name);
        console.log(`✅ ${branch}: ${wards.length} mobile wards`);
      } catch (err) {
        console.error(`❌ Failed to fetch for ${branch}:`, err.message);
        results[branch] = [];
      }
    }

    res.json(results);
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

////////////////////

app.get(
  "/patients_by_branch_ward",
  safeHandler(async (req, res) => {
    const branch = (req.query.branch || "korangi").toString().toLowerCase();
    const ward = req.query.ward;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = (page - 1) * limit;
    const search = (req.query.search || "").toString().trim();

    if (!branch || !ward) {
      return res.status(400).json({ error: "branch and ward are required" });
    }

    const db = await getDb(branch);

    // Build filters safely
    const whereParts = ["w.WARD_NAME = ?", "w.mobile_app = 1", "ar.status = 1"];
    const paramsCount = [ward];

    if (search) {
      // search on patient first/last name, PMR_NO or PATIENT_ID (adjust columns as needed)
      whereParts.push(
        "(pr.PATIENT_FNAME LIKE ? OR pr.PATIENT_LNAME LIKE ? OR pr.PMR_NO LIKE ? OR pr.PATIENT_ID LIKE ?)"
      );
      const term = `%${search}%`;
      paramsCount.push(term, term, term, term);
    }

    const whereSql = whereParts.length
      ? "WHERE " + whereParts.join(" AND ")
      : "";

    // 1) total count with search filter
    const [countRows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM adm_requests ar
      LEFT JOIN ward w ON ar.WARD_ID = w.WARD_ID
      LEFT JOIN prg_patient_reg pr ON ar.PATIENT_ID = pr.PATIENT_ID
      ${whereSql}
      `,
      paramsCount
    );
    const total = countRows[0]?.total || 0;

    // 2) paginated results with same filters
    const paramsData = [...paramsCount, limit, offset];
    const [results] = await db.query(
      `
  SELECT 
    ar.ADM_REQ_ID,
    ar.WARD_ID,
    w.WARD_NAME,
    pr.PATIENT_ID,
    pr.PMR_NO,
    pr.PATIENT_FNAME,
    pr.PATIENT_LNAME,
    TIMESTAMPDIFF(YEAR, pr.DOB, CURDATE()) AS AGE,
    pr.GENDER,
    pr.MOBILE_NO,
    ar.ADM_DATE
  FROM adm_requests ar
  LEFT JOIN ward w ON ar.WARD_ID = w.WARD_ID
  LEFT JOIN prg_patient_reg pr ON ar.PATIENT_ID = pr.PATIENT_ID
  ${whereSql}
  ORDER BY ar.ADM_DATE DESC
  LIMIT ? OFFSET ?
  `,
      paramsData
    );

    res.json({
      branch,
      ward,
      page,
      limit,
      total,
      hasMore: offset + results.length < total,
      patients: results,
    });
  })
);

/////////////////////
app.post(
  "/patients/:id/medicines",
  safeHandler(async (req, res) => {
    const branch = req.body.branch || req.query.branch || "korangi";
    const db = await getDb(branch);

    const patientId = req.params.id;
    const { medicines } = req.body;

    if (!patientId) {
      return res.status(400).json({ error: "Patient ID is required" });
    }

    if (!Array.isArray(medicines) || medicines.length === 0) {
      return res.status(400).json({ error: "Medicines array is required" });
    }

    const insertQuery = `
      INSERT INTO tr_pharmacy_store_request
      (PATIENT_ID, SUB_ITEM_CAT_ID, ward_dosage, diagnosis, Dosage, day_count, Dosage_Time, dosagetype, Remarks, DATE)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    try {
      for (const med of medicines) {
        const {
          SUB_ITEM_CAT_ID,
          ward_dosage,
          diagnosis,
          Dosage,
          day_count,
          Dosage_Time,
          dosagetype,
          remarks,
        } = med;

        if (!SUB_ITEM_CAT_ID || !Dosage || !day_count || !dosagetype) {
          return res.status(400).json({
            error:
              "Each medicine must have SUB_ITEM_CAT_ID, Dosage, day_count, and dosagetype",
          });
        }

        await db.query(insertQuery, [
          patientId,
          SUB_ITEM_CAT_ID,
          ward_dosage || null,
          diagnosis || "",
          Dosage,
          day_count,
          Dosage_Time || null,
          dosagetype,
          remarks || "",
        ]);
      }

      res.json({ success: true, message: "Medicines saved successfully" });
    } catch (err) {
      console.error("Error saving medicines:", err.message);
      res
        .status(500)
        .json({ error: "Failed to save medicines", details: err.message });
    }
  })
);

//  New code to register new tests

app.post(
  "/register-test",
  safeHandler(async (req, res) => {
    const branch = req.body.branch || req.query.branch || "korangi";
    const db = await getDb(branch);

    const {
      Patient_ID,
      LabNo,
      RegisterationDate,
      RegisterationTime,
      PatientName,
      Gender,
      Age,
      TestID,
      Remarks,
      ReferedID,
      TestSourceID,
      WardID,
      User_ID,
      PaymentComplete,
      NetAmount,
    } = req.body;

    // ✅ Basic validation
    if (!Patient_ID || !LabNo || !PatientName || !TestID) {
      return res.status(400).json({
        error:
          "Missing required fields: Patient_ID, LabNo, PatientName, TestID",
      });
    }

    // ✅ Prepare query
    const insertQuery = `
      INSERT INTO a_ordering (
        Patient_ID, 
        LabNo, 
        RegisterationDate, 
        RegisterationTime,
        PatientName,
        Gender,
        Age,
        TestID,
        Remarks,
        ReferedID,
        TestSourceID,
        WardID,
        User_ID,
        PaymentComplete,
        NetAmount
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      Patient_ID,
      LabNo,
      RegisterationDate || new Date().toISOString().split("T")[0],
      RegisterationTime || new Date().toLocaleTimeString("en-GB"),
      PatientName,
      Gender || "",
      Age || null,
      TestID,
      Remarks || "",
      ReferedID || null,
      TestSourceID || null,
      WardID || null,
      User_ID || null,
      PaymentComplete || 0,
      NetAmount || 0,
    ];

    try {
      const [result] = await db.query(insertQuery, values);
      res.json({
        success: true,
        message: "New test registered successfully",
        orderId: result.insertId,
      });
    } catch (err) {
      console.error("❌ Error inserting test:", err);
      res.status(500).json({
        error: "Failed to register test",
        details: err.message,
      });
    }
  })
);

// ==========================
// 🔹 TEST LIST (with Specimun)
// ==========================
app.get(
  "/test-list",
  safeHandler(async (req, res) => {
    const branch = req.query.branch || "korangi";
    const search = req.query.search ? `%${req.query.search}%` : "%";
    const db = await getDb(branch);

    const [rows] = await db.query(
      `
      SELECT TestID, TestTitle, Specimun
      FROM a_test
      WHERE TestTitle LIKE ? OR TestID LIKE ?
      ORDER BY Specimun DESC
      LIMIT 500
      `,
      [search, search]
    );

    res.json(rows);
  })
);

// ==========================
// 🔹 GET LATEST ORDER
// ==========================
app.get(
  "/latest-order",
  safeHandler(async (req, res) => {
    const branch = req.query.branch || "korangi";
    const db = await getDb(branch);

    const [rows] = await db.query(`
      SELECT 
        Order_Id,
        Barcode_no,
        Pkod_detail
      FROM a_order_detail
      ORDER BY CAST(Barcode_no AS UNSIGNED) DESC
      LIMIT 1
    `);

    if (!rows.length) {
      return res.status(404).json({ error: "No orders found" });
    }

    return res.json(rows[0]);
  })
);

// ==========================
// 🔹 BOOK MULTIPLE TESTS (JS version)
// ==========================
app.post(
  "/book-tests",
  safeHandler(async (req, res) => {
    const { tests = [], branch = "korangi", Order_Id } = req.body;

    if (!Order_Id) return res.status(400).json({ error: "Order_Id missing" });
    if (!Array.isArray(tests) || tests.length === 0) {
      return res.status(400).json({ error: "No tests provided" });
    }

    const db = await getDb(branch);

    try {
      await db.beginTransaction();

      const inserted = [];

      for (const t of tests) {
        const { TestID, Pkod_detail, Barcode_no } = t;

        await db.query(
          `INSERT INTO a_order_detail (Order_Id, TestID, Pkod_detail, Barcode_no)
           VALUES (?, ?, ?, ?)`,
          [Order_Id, TestID, Pkod_detail, Barcode_no]
        );

        inserted.push({ Order_Id, TestID, Pkod_detail, Barcode_no });
      }

      await db.commit();
      res.json({ success: true, Order_Id, records: inserted });
    } catch (err) {
      await db.rollback();
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  })
);

// ==========================
// 🔹 PREVIEW NEXT TESTS (no DB insert)
// ==========================
app.post(
  "/generate-next-tests",
  safeHandler(async (req, res) => {
    const { TestIDs = [], branch = "korangi" } = req.body;

    if (!Array.isArray(TestIDs) || TestIDs.length === 0) {
      return res.status(400).json({ error: "No tests provided" });
    }

    const db = await getDb(branch);

    // Fetch last inserted barcode and pkod
    const [lastRows] = await db.query(`
      SELECT Barcode_no, Pkod_detail
      FROM a_order_detail
      ORDER BY Order_Id DESC
      LIMIT 1
    `);

    let lastBarcode = lastRows[0]?.Barcode_no ?? "00000000";
    let lastPkodNum =
      parseInt(String(lastRows[0]?.Pkod_detail ?? 0).replace(/\D/g, ""), 10) ||
      0;

    const generated = [];

    for (const TestID of TestIDs) {
      const [specRows] = await db.query(
        `SELECT TestTitle, Specimun FROM a_test WHERE TestID = ? LIMIT 1`,
        [TestID]
      );

      if (!specRows.length) continue;

      const specCode = String(specRows[0].Specimun).padStart(2, "0"); // Specimun dynamic
      const barcodeBase = lastBarcode.slice(0, -2); // remove last 2 digits
      const newBarcode = barcodeBase + specCode; // append Specimun

      lastPkodNum++; // increment PKOD
      const newPkod = `${String(lastPkodNum).padStart(5, "0")}`;

      generated.push({
        TestID,
        TestTitle: specRows[0].TestTitle,
        Pkod_detail: newPkod,
        Barcode_no: newBarcode,
        Specimun: specRows[0].Specimun,
      });

      lastBarcode = newBarcode; // update for next test
    }

    res.json({ success: true, generated });
  })
);

// ==========================
// ✅ START SERVER
// ==========================
const PORT = 3000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`)
);
