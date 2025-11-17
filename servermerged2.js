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
  azambasti: "convert_april_azambasti",
  chs: "convert_april_chs",
  jamshoro: "convert_april_jamshoro",
  korangi: "convert_april_k5",
  larkana: "convert_april_larkana",
  sba: "convert_april_sba",
  sobhraj: "convert_april_sobhraj",
  ho: "convert_april_HO",
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
    
    // ✅ Show only relevant fields for debugging
    const [results] = await db.query(
      "SELECT ADMIN_ID, GR_EMPLOYER_LOGIN FROM admin LIMIT 10"
    );
    
    console.log("📋 Admin Records Found:", results.length);
    results.forEach((user, idx) => {
      const hasDash = user.GR_EMPLOYER_LOGIN ? user.GR_EMPLOYER_LOGIN.includes("-") : false;
      const pinNumber = hasDash ? user.GR_EMPLOYER_LOGIN.split("-")[1] : null;
      console.log(`${idx + 1}. ADMIN_ID: ${user.ADMIN_ID}, GR_EMPLOYER_LOGIN: "${user.GR_EMPLOYER_LOGIN}", Has Dash: ${hasDash}, PinNumber: ${pinNumber}`);
    });
    
    res.json(results);
  })
);

app.post(
  "/login",
  safeHandler(async (req, res) => {
    // ✅ ALWAYS use Korangi database for login (central admin table)
    const loginDb = await getDb("korangi");
    
    // ✅ But remember which branch user wants to work at
    const selectedBranch = req.body.branch || req.query.branch || "korangi";

    const rawUsername = req.body.username || "";
    const password = req.body.password || "";
    const username = rawUsername.trim();
    
    console.log("🔐 Login Attempt:", {
      username,
      passwordProvided: password ? `${password.substring(0, 1)}***` : "empty",
      loginDatabase: "korangi (central)",
      selectedBranch
    });
    
    if (!username || !password)
      return res.status(400).json({ error: "Missing credentials" });

    // ✅ Password is fixed to "Sichn" for all users
    if (password !== "Sichn") {
      console.log("❌ Login Failed: Incorrect master password");
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    // ✅ Query Korangi database (central admin table) using GR_EMPLOYER_LOGIN as username
    const [results] = await loginDb.query(
      `SELECT 
         a.ADMIN_ID, 
         a.GR_EMPLOYER_LOGIN,
         a.ADMIN_FIRST_NAME,
         a.ADMIN_LAST_NAME,
         epi.manager_status
       FROM admin a 
       LEFT JOIN eis_personal_information epi 
         ON epi.EIS_EMPLOYEE_CODE = a.GR_EMPLOYER_LOGIN
       WHERE a.GR_EMPLOYER_LOGIN = ? 
       LIMIT 1`,
      [username]
    );

    if (results.length > 0) {
      const user = results[0];
      
      // ✅ Extract PinNumber from GR_EMPLOYER_LOGIN (format: "270125-1129" → "1129")
      let pinNumber = null;
      
      console.log("✅ Login Success! User found in Korangi DB:", {
        ADMIN_ID: user.ADMIN_ID,
        GR_EMPLOYER_LOGIN: user.GR_EMPLOYER_LOGIN,
        selectedBranch,
        ADMIN_FIRST_NAME: user.ADMIN_FIRST_NAME || null,
        ADMIN_LAST_NAME: user.ADMIN_LAST_NAME || null,
        manager_status: typeof user.manager_status === "number" ? user.manager_status : null,
        hasDash: user.GR_EMPLOYER_LOGIN ? user.GR_EMPLOYER_LOGIN.includes("-") : false
      });
      
      if (user.GR_EMPLOYER_LOGIN && user.GR_EMPLOYER_LOGIN.includes("-")) {
        pinNumber = user.GR_EMPLOYER_LOGIN.split("-")[1];
        console.log("✅ PinNumber extracted:", pinNumber);
      } else {
        // ⚠️ Fallback: If no dash, use ADMIN_ID as PinNumber
        pinNumber = String(user.ADMIN_ID);
        console.log("⚠️ No dash found - using ADMIN_ID as PinNumber:", pinNumber);
      }

      res.json({ 
        success: true, 
        user: {
          ...user,
          pinNumber,  // ✅ Add PinNumber to response
          branch: selectedBranch,  // ✅ Include selected branch
          manager_status: typeof user.manager_status === "number" ? user.manager_status : null
        }
      });
    } else {
      console.log("❌ Login Failed: No matching user found in Korangi DB");
      res.status(401).json({ success: false, error: "Invalid credentials" });
    }
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
      ho: "convert_april_HO",
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
// 🔹 BOOK MULTIPLE TESTS (JS version) — UPDATED
// ==========================
app.post(
  "/book-tests",
  safeHandler(async (req, res) => {
    const { tests = [], branch = "korangi", Order_Id, Patient_ID } = req.body;

    if (!Order_Id) return res.status(400).json({ error: "Order_Id missing" });
    if (!Patient_ID)
      return res.status(400).json({ error: "Patient_ID missing" });
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
          `INSERT INTO a_order_detail (Order_Id, Patient_ID, TestID, Pkod_detail, Barcode_no)
           VALUES (?, ?, ?, ?, ?)`,
          [Order_Id, Patient_ID, TestID, Pkod_detail, Barcode_no]
        );

        inserted.push({
          Order_Id,
          Patient_ID,
          TestID,
          Pkod_detail,
          Barcode_no,
        });
      }

      await db.commit();
      res.json({ success: true, Order_Id, Patient_ID, records: inserted });
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
// 🕐 ATTENDANCE ENDPOINTS
// ==========================

// ✅ Get attendance history for a user
app.get(
  "/attendance/:pinNumber",
  safeHandler(async (req, res) => {
    const branch = req.query.branch || "korangi";
    const db = await getDb(branch);
    const { pinNumber } = req.params;
    const limit = parseInt(req.query.limit) || 30;

    // ✅ Remove leading zeros from PinNumber
    const pinNumberInt = parseInt(pinNumber, 10);

    console.log("📥 Fetching attendance history:", {
      pinNumber,
      pinNumberInt,
      branch,
      limit
    });

    const [results] = await db.query(
      `SELECT 
        AttendanceID,
        PinNumber,
        DATE_FORMAT(AttendanceDate, '%Y-%m-%d') AS AttendanceDate,
        AttendanceTime,
        timeIn,
        timeOut,
        Status,
        MachineName,
        AttendanceDateTime
      FROM as_attendance
      WHERE PinNumber = ?
      ORDER BY AttendanceDate DESC, AttendanceTime DESC
      LIMIT ?`,
      [pinNumberInt, limit]
    );

    console.log("📊 Found records:", results.length);
    if (results.length > 0) {
      console.log("📋 First record:", results[0]);
    }

    res.json(results);
  })
);

// ✅ Mark attendance (Time In)
app.post(
  "/attendance/mark",
  safeHandler(async (req, res) => {
    const branch = req.body.branch || req.query.branch || "korangi";
    const db = await getDb(branch);

    const { pinNumber, deviceName, imei } = req.body;

    if (!pinNumber) {
      return res.status(400).json({ error: "PinNumber is required" });
    }
    
    console.log("📱 Device Info Received:", { deviceName, imei });

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0]; // 2025-11-11
    const timeStr24 = now.toTimeString().split(" ")[0]; // 14:30:45
    const dateTimeStr = now.toISOString().slice(0, 19).replace("T", " "); // 2025-11-11 14:30:45
    
    // ✅ Format time as "HH:MM AM/PM" for AttendanceTime column
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 || 12;
    const formattedTime = `${displayHour.toString().padStart(2, "0")}:${minutes} ${ampm}`; // "05:09 PM"
    
    // ✅ CONSTANT values for timeIn and timeOut
    const timeInShort = "08:15";
    const timeOutShort = "15:55";

    // ✅ Remove leading zeros from PinNumber (store as integer)
    const pinNumberInt = parseInt(pinNumber, 10);

    // ✅ Check if late: After 9:15 AM
    const totalMinutes = hours * 60 + parseInt(minutes);
    const cutoffMinutes = 9 * 60 + 15; // 9:15 AM = 555 minutes
    const isLate = totalMinutes > cutoffMinutes;
    
    console.log("⏰ Time Check:", {
      currentTime: `${hours}:${minutes}`,
      totalMinutes,
      cutoffMinutes,
      isLate
    });

    // ✅ Check if already marked today
    const [existing] = await db.query(
      `SELECT AttendanceID, timeIn, timeOut, Status 
       FROM as_attendance 
       WHERE PinNumber = ? AND AttendanceDate = ?
       ORDER BY AttendanceID DESC
       LIMIT 1`,
      [pinNumberInt, dateStr]
    );

    if (existing.length > 0) {
      // ✅ Already marked today - return existing record
      return res.json({
        success: true,
        message: "Attendance already marked today",
        alreadyMarked: true,
        attendance: existing[0],
        isLate: existing[0].Status === 1 ? isLate : undefined, // Return late status for existing record
      });
    }

    // ✅ Get next AttendanceID manually (since auto-increment might not be working)
    const [[{ maxId }]] = await db.query(
      `SELECT COALESCE(MAX(AttendanceID), 0) + 1 AS maxId FROM as_attendance`
    );

    console.log("🔢 Next AttendanceID:", maxId);

    // ✅ Insert new attendance record with explicit AttendanceID
    // Status: 1 = Check In (Time In)
    const [result] = await db.query(
      `INSERT INTO as_attendance (
        AttendanceID,
        PinNumber,
        AttendanceDate,
        AttendanceTime,
        AttendanceDateTime,
        timeIn,
        timeOut,
        Status,
        MachineName,
        DeviceName,
        IMEI,
        MachineID,
        \`Read\`,
        sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        maxId,               // Explicit AttendanceID
        pinNumberInt,        // 429 (integer, not "0429")
        dateStr,             // 2025-11-11
        formattedTime,       // "05:09 PM"
        dateTimeStr,         // 2025-11-11 17:09:42
        timeInShort,         // "08:15"
        timeOutShort,        // "15:55"
        1,                   // Status: 1 = Check In
        "mobile app",        // MachineName
        deviceName || "Unknown Device", // DeviceName
        imei || null,        // IMEI (Unique Device ID)
        1,                   // MachineID (always 1 for mobile app)
        0,                   // Read
        0,                   // sync_status
      ]
    );

    console.log("✅ Attendance inserted:", {
      AttendanceID: maxId,
      PinNumber: pinNumberInt,
      Status: 1,
      timeIn: timeInShort,
      isLate,
      insertResult: result
    });

    res.json({
      success: true,
      message: isLate 
        ? "⚠️ Time In marked - LATE (After 9:15 AM)" 
        : "✅ Time In marked - ON TIME",
      attendanceId: maxId,
      status: 1,
      timeIn: timeInShort,
      date: dateStr,
      isLate,
      statusText: isLate ? "Late" : "On Time"
    });
  })
);

// ✅ Mark Time Out (NEW: Insert separate entry instead of update)
app.post(
  "/attendance/timeout",
  safeHandler(async (req, res) => {
    const branch = req.body.branch || req.query.branch || "korangi";
    const db = await getDb(branch);

    const { pinNumber, deviceName, imei } = req.body;

    console.log("🔄 Time Out Request:", { pinNumber, branch, deviceName, imei });

    if (!pinNumber) {
      return res.status(400).json({ error: "PinNumber is required" });
    }

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const dateTimeStr = now.toISOString().slice(0, 19).replace("T", " ");
    
    // ✅ Get actual time for late/early detection
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, "0");
    
    // ✅ CONSTANT values for timeIn and timeOut
    const timeInShort = "08:15";
    const timeOutShort = "15:55";
    
    // ✅ Format time as "HH:MM AM/PM" for AttendanceTime column
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 || 12;
    const formattedTime = `${displayHour.toString().padStart(2, "0")}:${minutes} ${ampm}`;

    // ✅ Remove leading zeros from PinNumber
    const pinNumberInt = parseInt(pinNumber, 10);

    // ✅ Check if left early: Before 4:55 PM (16:55)
    const totalMinutes = hours * 60 + parseInt(minutes);
    const endTimeMinutes = 16 * 60 + 55; // 4:55 PM = 1015 minutes
    const leftEarly = totalMinutes < endTimeMinutes;
    
    console.log("⏰ Check Out Time Check:", {
      currentTime: `${hours}:${minutes}`,
      totalMinutes,
      endTimeMinutes,
      leftEarly
    });

    // ✅ Check if user already checked in today
    const [existing] = await db.query(
      `SELECT AttendanceID, Status 
       FROM as_attendance 
       WHERE PinNumber = ? AND AttendanceDate = ? AND Status = 1
       ORDER BY AttendanceID DESC
       LIMIT 1`,
      [pinNumberInt, dateStr]
    );

    if (existing.length === 0) {
      console.log("❌ No check-in record found");
      return res.status(404).json({ 
        error: "No check-in record found for today. Please Check In first." 
      });
    }

    // ✅ Check if already checked out today
    const [checkoutRecord] = await db.query(
      `SELECT AttendanceID 
       FROM as_attendance 
       WHERE PinNumber = ? AND AttendanceDate = ? AND Status = 2
       ORDER BY AttendanceID DESC
       LIMIT 1`,
      [pinNumberInt, dateStr]
    );

    if (checkoutRecord.length > 0) {
      console.log("⚠️ Already checked out today");
      return res.json({
        success: true,
        message: "Time Out already marked",
        alreadyMarked: true,
        status: 2
      });
    }

    // ✅ Get next AttendanceID
    const [[{ maxId }]] = await db.query(
      `SELECT COALESCE(MAX(AttendanceID), 0) + 1 AS maxId FROM as_attendance`
    );

    console.log("🔢 Next AttendanceID for checkout:", maxId);

    // ✅ INSERT new entry for Check Out (Status = 2)
    const [result] = await db.query(
      `INSERT INTO as_attendance (
        AttendanceID,
        PinNumber,
        AttendanceDate,
        AttendanceTime,
        AttendanceDateTime,
        timeIn,
        timeOut,
        Status,
        MachineName,
        DeviceName,
        IMEI,
        MachineID,
        \`Read\`,
        sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        maxId,
        pinNumberInt,
        dateStr,
        formattedTime,
        dateTimeStr,
        timeInShort,       // "08:15"
        timeOutShort,      // "15:55"
        2,                 // Status: 2 = Check Out
        "mobile app",
        deviceName || "Unknown Device", // DeviceName
        imei || null,      // IMEI (Unique Device ID)
        1,
        0,
        0,
      ]
    );

    console.log("✅ Check Out entry inserted:", {
      AttendanceID: maxId,
      PinNumber: pinNumberInt,
      Status: 2,
      timeOut: timeOutShort,
      leftEarly
    });

    res.json({
      success: true,
      message: leftEarly
        ? "⚠️ Time Out marked - LEFT EARLY (Before 4:55 PM)"
        : "✅ Time Out marked - FULL DAY",
      timeOut: timeOutShort,
      status: 2,
      attendanceId: maxId,
      leftEarly,
      statusText: leftEarly ? "Left Early" : "Full Day"
    });
  })
);

// ==========================
// 🍃 LEAVE MANAGEMENT ENDPOINTS
// ==========================

// ✅ Get all leave types from database
app.get(
  "/leave-types",
  safeHandler(async (req, res) => {
    const branch = req.query.branch || "korangi";
    const db = await getDb(branch);

    const [results] = await db.query(
      `SELECT 
        leave_type_id as id,
        name,
        applicable_to as applicableTo,
        monthly_quota as monthlyQuota
      FROM leave_types_fth
      ORDER BY leave_type_id`
    );

    res.json(results);
  })
);

// ✅ Get employee leave balances
app.get(
  "/leave-balance/:pinNumber",
  safeHandler(async (req, res) => {
    const branch = req.query.branch || "korangi";
    const db = await getDb(branch);
    const { pinNumber } = req.params;

    const pinNumberInt = parseInt(pinNumber, 10);

    try {
      console.log("📥 Fetching leave balance for employee_id:", pinNumberInt);
      
      // Get current balances grouped by leave type
      const [balances] = await db.query(
        `SELECT 
          la.leave_type_id as leaveTypeId,
          lt.name as leaveTypeName,
          SUM(la.accrued_amount) as totalAccrued,
          lt.monthly_quota as monthlyQuota,
          lt.applicable_to as applicableTo
        FROM leave_accruals_fth la
        LEFT JOIN leave_types_fth lt ON la.leave_type_id = lt.leave_type_id
        WHERE la.employee_id = ?
        GROUP BY la.leave_type_id, lt.name, lt.monthly_quota, lt.applicable_to`,
        [pinNumberInt]
      );

      console.log("✅ Leave balance results:", balances.length, "records found");
      res.json(balances);
    } catch (err) {
      // Employee might not have accruals yet or table doesn't exist - return empty array
      console.log("⚠️ Error fetching leave balance for employee", pinNumberInt, ":", err.message);
      res.json([]);
    }
  })
);

// ✅ Get all leave requests for a user
app.get(
  "/leaves/:pinNumber",
  safeHandler(async (req, res) => {
    const branch = req.query.branch || "korangi";
    const db = await getDb(branch);
    const { pinNumber } = req.params;

    const pinNumberInt = parseInt(pinNumber, 10);

    try {
      console.log("📥 Fetching leave requests for employee_id:", pinNumberInt);
      
      const [results] = await db.query(
        `SELECT 
          lr.leave_id as id,
          lr.employee_id as pinNumber,
          lr.leave_type_id as leaveTypeId,
          lt.name as leaveType,
          DATE_FORMAT(lr.start_date, '%Y-%m-%d') as startDate,
          DATE_FORMAT(lr.end_date, '%Y-%m-%d') as endDate,
          lr.reason,
          lr.status,
          lr.total_days as daysRequested,
          lr.total_days_deduction as daysDeduction,
          lr.approved_by as approvedBy,
          lr.current_stage as currentStage,
          DATE_FORMAT(lr.start_date, '%Y-%m-%d') as requestDate
        FROM leave_requests_fth lr
        LEFT JOIN leave_types_fth lt ON lr.leave_type_id = lt.leave_type_id
        WHERE lr.employee_id = ?
        ORDER BY lr.leave_id DESC`,
        [pinNumberInt]
      );

      console.log("✅ Leave requests results:", results.length, "records found");
      res.json(results);
    } catch (err) {
      // Table might not exist yet - return empty array
      console.log("⚠️ Error fetching leave requests:", err.message);
      res.json([]);
    }
  })
);

// ✅ Submit new leave request
app.post(
  "/leaves/request",
  safeHandler(async (req, res) => {
    const branch = req.body.branch || req.query.branch || "korangi";
    const db = await getDb(branch);

    const { pinNumber, leaveTypeId, startDate, endDate, reason } = req.body;

    if (!pinNumber || !leaveTypeId || !startDate || !endDate || !reason) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const pinNumberInt = parseInt(pinNumber, 10);

    // ✅ Calculate days requested
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    console.log("📝 Inserting leave request:", {
      employee_id: pinNumberInt,
      leave_type_id: leaveTypeId,
      start_date: startDate,
      end_date: endDate,
      total_days: totalDays,
      reason: reason
    });

    // ✅ Insert into existing leave_requests_fth table
    const [result] = await db.query(
      `INSERT INTO leave_requests_fth 
        (employee_id, leave_type_id, start_date, end_date, total_days, total_days_deduction, status, reason, current_stage)
      VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?, NULL)`,
      [pinNumberInt, leaveTypeId, startDate, endDate, totalDays, totalDays, reason]
    );

    console.log("✅ Leave request inserted with ID:", result.insertId);

    res.json({
      success: true,
      message: "Leave request submitted successfully",
      leaveId: result.insertId,
      daysRequested: totalDays,
    });
  })
);

// ✅ Approve leave request (Admin only)
app.put(
  "/leaves/:id/approve",
  safeHandler(async (req, res) => {
    const branch = req.body.branch || req.query.branch || "korangi";
    const db = await getDb(branch);
    const { id } = req.params;
    const { approvedBy } = req.body;

    if (!approvedBy) {
      return res.status(400).json({ error: "approvedBy is required" });
    }

    const [result] = await db.query(
      `UPDATE leave_requests_fth 
       SET status = 'Approved', approved_by = ?
       WHERE leave_id = ?`,
      [approvedBy, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Leave request not found" });
    }

    res.json({
      success: true,
      message: "Leave request approved",
    });
  })
);

// ✅ Reject leave request (Admin only)
app.put(
  "/leaves/:id/reject",
  safeHandler(async (req, res) => {
    const branch = req.body.branch || req.query.branch || "korangi";
    const db = await getDb(branch);
    const { id } = req.params;
    const { rejectionReason, rejectedBy } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({ error: "rejectionReason is required" });
    }

    const [result] = await db.query(
      `UPDATE leave_requests_fth 
       SET status = 'Rejected', reason = ?, approved_by = ?
       WHERE leave_id = ?`,
      [rejectionReason, rejectedBy || "Admin", id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Leave request not found" });
    }

    res.json({
      success: true,
      message: "Leave request rejected",
    });
  })
);

// ✅ Get all pending leave requests (for Admin dashboard)
app.get(
  "/leaves/pending/all",
  safeHandler(async (req, res) => {
    const branch = req.query.branch || "korangi";
    const db = await getDb(branch);

    const [results] = await db.query(
      `SELECT 
        lr.leave_id as id,
        lr.employee_id as pinNumber,
        lr.leave_type_id as leaveTypeId,
        lt.name as leaveType,
        DATE_FORMAT(lr.start_date, '%Y-%m-%d') as startDate,
        DATE_FORMAT(lr.end_date, '%Y-%m-%d') as endDate,
        lr.total_days as daysRequested,
        lr.reason,
        lr.status,
        DATE_FORMAT(lr.start_date, '%Y-%m-%d') as requestDate,
        a.GR_EMPLOYER_LOGIN as employeeName
      FROM leave_requests_fth lr
      LEFT JOIN leave_types_fth lt ON lr.leave_type_id = lt.leave_type_id
      LEFT JOIN admin a ON lr.employee_id = CAST(SUBSTRING_INDEX(a.GR_EMPLOYER_LOGIN, '-', -1) AS UNSIGNED)
      WHERE lr.status = 'Pending'
      ORDER BY lr.leave_id DESC`
    );

    res.json(results);
  })
);

// ✅ Get attendance statistics
app.get(
  "/attendance/:pinNumber/stats",
  safeHandler(async (req, res) => {
    const branch = req.query.branch || "korangi";
    const db = await getDb(branch);
    const { pinNumber } = req.params;

    // ✅ Remove leading zeros from PinNumber
    const pinNumberInt = parseInt(pinNumber, 10);

    // ✅ Get all attendance records to calculate Late/Early days
    const [records] = await db.query(
      `SELECT 
        AttendanceDate,
        AttendanceTime,
        Status
      FROM as_attendance
      WHERE PinNumber = ?
      ORDER BY AttendanceDate DESC`,
      [pinNumberInt]
    );

    console.log(`\n🔍 Found ${records.length} attendance records for PinNumber ${pinNumberInt}`);
    console.log("Sample records:", records.slice(0, 5).map(r => ({
      date: r.AttendanceDate,
      time: r.AttendanceTime,
      status: r.Status
    })));

    // ✅ Helper function to parse "HH:MM AM/PM" format to 24-hour minutes
    const parseAttendanceTime = (timeStr) => {
      if (!timeStr) {
        console.log("⚠️ parseAttendanceTime: Empty timeStr");
        return null;
      }
      try {
        const [time, period] = timeStr.split(" ");
        const [hoursStr, minutesStr] = time.split(":");
        let hours = parseInt(hoursStr);
        const minutes = parseInt(minutesStr);
        
        // Convert to 24-hour format
        if (period === "PM" && hours !== 12) {
          hours += 12;
        } else if (period === "AM" && hours === 12) {
          hours = 0;
        }
        
        const totalMinutes = hours * 60 + minutes;
        console.log(`🕐 Parsed "${timeStr}" → ${hours}:${minutes} (${totalMinutes} minutes)`);
        return totalMinutes;
      } catch (err) {
        console.log(`❌ Parse error for "${timeStr}":`, err.message);
        return null;
      }
    };

    // ✅ Group records by date (since we have 2 records per day now: Status=1 and Status=2)
    const dateMap = new Map();
    
    records.forEach((record) => {
      // ✅ Convert Date object to string format (YYYY-MM-DD) for proper Map grouping
      const dateObj = new Date(record.AttendanceDate);
      const dateStr = dateObj.toISOString().split('T')[0]; // "2025-11-13"
      
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, { checkIn: null, checkOut: null });
      }
      
      const dayData = dateMap.get(dateStr);
      if (record.Status === 1) {
        dayData.checkIn = record;
      } else if (record.Status === 2) {
        dayData.checkOut = record;
      }
    });

    let totalDays = 0;
    let lateDays = 0;
    let onTimeDays = 0;
    let leftEarlyDays = 0;
    let fullDays = 0;

    // ✅ Calculate stats: Only count days with at least a check-in
    console.log(`\n📊 Processing ${dateMap.size} unique dates...`);
    
    dateMap.forEach((dayData, date) => {
      console.log(`\n📅 Date: ${date}`);
      console.log(`   Check In: ${dayData.checkIn ? `Status=${dayData.checkIn.Status}, Time="${dayData.checkIn.AttendanceTime}"` : "None"}`);
      console.log(`   Check Out: ${dayData.checkOut ? `Status=${dayData.checkOut.Status}, Time="${dayData.checkOut.AttendanceTime}"` : "None"}`);
      
      if (dayData.checkIn) {
        totalDays++;

        // Check if late (after 9:15 AM) using AttendanceTime
        const checkInMinutes = parseAttendanceTime(dayData.checkIn.AttendanceTime);
        if (checkInMinutes !== null) {
          const cutoffMinutes = 9 * 60 + 15; // 9:15 AM = 555 minutes
          
          if (checkInMinutes > cutoffMinutes) {
            console.log(`   ❌ LATE: ${checkInMinutes} > ${cutoffMinutes}`);
            lateDays++;
          } else {
            console.log(`   ✅ ON TIME: ${checkInMinutes} <= ${cutoffMinutes}`);
            onTimeDays++;
          }
        }

        // Check if left early (before 4:55 PM) - only if checked out
        if (dayData.checkOut) {
          console.log(`   🔍 Checkout AttendanceTime raw value: "${dayData.checkOut.AttendanceTime}"`);
          const checkOutMinutes = parseAttendanceTime(dayData.checkOut.AttendanceTime);
          console.log(`   🔍 Parsed checkOutMinutes: ${checkOutMinutes}`);
          
          if (checkOutMinutes !== null) {
            const endTimeMinutes = 16 * 60 + 55; // 4:55 PM = 1015 minutes
            
            if (checkOutMinutes < endTimeMinutes) {
              console.log(`   ⚠️ LEFT EARLY: ${checkOutMinutes} < ${endTimeMinutes}`);
              leftEarlyDays++;
            } else {
              console.log(`   ✅ FULL DAY: ${checkOutMinutes} >= ${endTimeMinutes}`);
              fullDays++;
            }
          } else {
            console.log(`   ❌ ERROR: checkOutMinutes is NULL! Cannot compare.`);
          }
        } else {
          console.log(`   ⏳ No checkout record for this day`);
        }
      }
    });

    console.log("📊 Attendance Stats:", {
      totalDays,
      lateDays,
      onTimeDays,
      leftEarlyDays,
      fullDays
    });
    
    res.json({ 
      totalDays,
      lateDays,
      onTimeDays,
      leftEarlyDays,
      fullDays,
      checkIns: records.filter(r => r.Status === 1).length,
      checkOuts: records.filter(r => r.Status === 2).length
    });
  })
);

// ==========================
// ✅ START SERVER
// ==========================
const PORT = 3000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`)
);
