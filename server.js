import cors from "cors";
import express from "express";
import mysql from "mysql2";

// ✅ Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// ✅ MySQL connection
const db = mysql.createConnection({
  host: "192.168.1.130", // MySQL server IP
  user: "labintegration",
  password: "chkefro",
  database: "convert_april",
  connectTimeout: 10000, // 10 seconds
});

db.connect((err) => {
  if (err) {
    console.error("❌ DB Connection Error:", err);
  } else {
    console.log("✅ Connected to database");
  }
});

/* ==========================
      🔑 LOGIN ENDPOINTS
========================== */

// ✅ Fetch all admins
app.get("/admin", (req, res) => {
  const sql = `
    SELECT ADMIN_ID, GR_EMPLOYER_LOGIN
    FROM admin
  `; // ⚠️ Replace with your actual admin table

  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ SQL Error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// ✅ POST login
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Missing credentials" });
  }

  const sql = `
    SELECT ADMIN_ID, GR_EMPLOYER_LOGIN
    FROM admin_users
    WHERE ADMIN_ID = ? AND GR_EMPLOYER_LOGIN = ?
    LIMIT 1
  `;

  db.query(sql, [username, password], (err, results) => {
    if (err) {
      console.error("❌ SQL Error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length > 0) {
      res.json({ success: true, user: results[0] });
    } else {
      res.status(401).json({ success: false, error: "Invalid credentials" });
    }
  });
});

/* ==========================
      🔍 SEARCH ENDPOINT
========================== */
app.get("/search", (req, res) => {
  const { query, page = 1, limit = 50 } = req.query;

  if (!query) return res.status(400).json({ error: "Query is required" });

  const offset = (Number(page) - 1) * Number(limit);

  const sql = `
    SELECT 
      PATIENT_ID,
      PMR_NO,
      PATIENT_FNAME,
      GENDER,
      DISTRICT,
      DOB,
      MOBILE_NO,
      TIMESTAMPDIFF(YEAR, DOB, CURDATE()) AS AGE
    FROM prg_patient_reg
    WHERE PATIENT_ID LIKE ? OR PATIENT_FNAME LIKE ?
    LIMIT ? OFFSET ?
  `;

  const searchTerm = `%${query}%`;

  db.query(sql, [searchTerm, searchTerm, Number(limit), Number(offset)], (err, results) => {
    if (err) {
      console.error("❌ SQL Error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// ==========================
// 🔍 SEARCH & PAGINATION FOR PATIENTS (JOINED WITH adm_requests)
// ==========================
app.get("/patients_all", (req, res) => {
  let page = parseInt(req.query.page) || 1;
  let limit = parseInt(req.query.limit) || 10;
  let search = req.query.search || "";
  let ward = req.query.ward || "";      // ✅ Ward filter
  let branch = req.query.branch || "";  // ✅ Branch filter (only "Korangi" supported for now)
  let offset = (page - 1) * limit;

  // Base SQL with JOIN
  let sql = `
    SELECT 
      ar.*,
      pr.PATIENT_ID, pr.PATIENT_FNAME, pr.PATIENT_LNAME,
      pr.GENDER, pr.PHONE_NO, pr.DATE_REG, pr.REGISTER_BY, 
      pr.DISTRICT, pr.CITY, pr.DOB, pr.CNIC, pr.STREET, 
      pr.TEMP_STATUS, pr.MOBILE_NO, pr.FATHER_HUSBAND, pr.PMR_NO,
      TIMESTAMPDIFF(YEAR, pr.DOB, CURDATE()) AS AGE
    FROM adm_requests ar
    LEFT JOIN prg_patient_reg pr ON ar.PATIENT_ID = pr.PATIENT_ID
    WHERE ar.status = 1
  `;

  let params = [];

  // ✅ Apply search filter
  if (search) {
    sql += ` AND (pr.PATIENT_FNAME LIKE ? OR pr.PATIENT_LNAME LIKE ? OR pr.PMR_NO LIKE ? OR pr.PATIENT_ID LIKE ?)`;
    let term = `%${search}%`;
    params.push(term, term, term, term);
  }

  // ✅ Apply ward filter (921, 1116, 1119)
  if (ward) {
    sql += ` AND ar.WARD_ID = ?`;
    params.push(ward);
  }

  // ✅ Apply branch filter (hardcoded: Korangi → just return all for now)
  // later if you have BRANCH_ID column, you can filter here.
  if (branch && branch.toLowerCase() !== "korangi") {
    return res.json([]); // no other branches supported
  }

  // ✅ Pagination
  sql += ` ORDER BY pr.PATIENT_ID DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: "Database error", details: err });
    res.json(results);
  });
});

/* ==========================
   👤 PATIENT ENDPOINTS
========================== */

// ✅ Get single patient
app.get("/patients/:id", (req, res) => {
  const patientId = req.params.id;

  const sql = `
    SELECT 
      PATIENT_ID,
      PATIENT_FNAME,
      GENDER,
      DISTRICT,
      DOB,
      MOBILE_NO,
      TIMESTAMPDIFF(YEAR, DOB, CURDATE()) AS AGE
    FROM prg_patient_reg
    WHERE PATIENT_ID = ?
  `;

  db.query(sql, [patientId], (err, results) => {
    if (err) {
      console.error("❌ SQL Error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length === 0) return res.status(404).json({ error: "Patient not found" });
    res.json(results[0]);
  });
});

// ✅ Fetch patient notes
app.get("/patients/:id/notes", (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT 
      Loc_ID, 
      PATIENT_ID, 
      OPD_VISIT_ID, 
      COALESCE(LocalExamination, '') AS LocalExamination,
      DATE(loc_ex_date) AS date
    FROM opd_local_examination
    WHERE PATIENT_ID = ?
    ORDER BY Loc_ID DESC
  `;

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("❌ SQL Error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// ✅ Fetch radiology reports
app.get("/patients/:id/radiology", (req, res) => {
  const patientId = req.params.id;

  const sql = `
    SELECT 
      id, 
      pmr_no, 
      status, 
      xray_status, 
      ct_status, 
      request_time, 
      Priority AS priority, 
      \`mod\` AS modality, 
      mod_type, 
      mod_region, 
      short_history 
    FROM tr_newris_request 
    WHERE PATIENT_ID = ?
    ORDER BY id DESC
  `;

  db.query(sql, [patientId], (err, results) => {
    if (err) {
      console.error("❌ SQL Error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// ✅ Fetch lab reports
app.get("/patients/:id/lab", (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT 
      o.Patient_ID,
      o.Order_Id,
      d.Barcode_no,
      r.id,
      r.LabNo,
      r.TestID,
      r.PMR_NO,
      r.Result_date_time,
      r.Read,
      r.ComponentID,
      r.Unit,
      r.Result,
      r.NormalRange,
      r.TranOrder,
      r.Heading,
      r.Remarks,
      r.IncludeInWorkSheet,
      r.IncludeInResult,
      r.ResultHeading,
      r.PIV,
      r.CutOffValue,
      r.Reader,
      r.Ready,
      r.IsTechnologist,
      r.IsPathologist,
      COALESCE(r.ResultHeading, r.Heading, r.TestID, '') AS test,
      r.Result AS result,
      r.Unit AS unit,
      r.NormalRange AS normal_range,
      r.Result_date_time AS date
    FROM a_ordering o
    LEFT JOIN a_order_detail d ON o.Order_Id = d.Order_Id
    LEFT JOIN a_detailresultentry r ON d.Barcode_no = r.Barcode_no
    WHERE o.Patient_ID = ?
    ORDER BY r.Result_date_time DESC
    LIMIT 500;
  `;

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("❌ SQL Error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

/* ==========================
      🔍 COUNT RECORDS
========================== */
app.get("/tr_newris_request/count", (req, res) => {
  const sql = `SELECT COUNT(*) AS total_count FROM tr_newris_request`;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ SQL Error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results[0]);
  });
});

/* ==========================
   🛏️ WARD BEDS ENDPOINT
========================== */
app.get("/ward_beds", (req, res) => {
  const sql = `
    SELECT WARD_ID, WD_OCC_STATUS 
    FROM ward_beds
    WHERE WARD_ID IN (921, 1116, 1119)
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ SQL Error:", err);
      return res.status(500).json({ error: "Database error" });
    }

    // Map ward IDs to names
    const wardMapping = {
      921: "PICU",
      1116: "NICU",
      1119: "GP",
    };

    const formatted = results.map(r => ({
      ward: wardMapping[r.WARD_ID] || r.WARD_ID,
      status: r.WD_OCC_STATUS,
    }));

    res.json(formatted);
  });
});

/* ==========================
       🚀 START SERVER
========================== */
const PORT = 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
