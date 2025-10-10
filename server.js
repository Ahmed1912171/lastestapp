// server.js
import cors from "cors";
import express from "express";
import mysql from "mysql2/promise";

// ✅ Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// ✅ MySQL connection
let db;
async function initDb() {
  try {
    db = await mysql.createConnection({
      host: "192.168.1.130",
      user: "labintegration",
      password: "chkefro",
      database: "convert_april",
      connectTimeout: 10000,
    });
    console.log("✅ Connected to database");
  } catch (err) {
    console.error("❌ DB Connection Failed:", err);
    process.exit(1);
  }
}
await initDb();

/* ==========================
      🔑 LOGIN ENDPOINTS
========================== */

// Fetch all admins
app.get("/admin", async (req, res) => {
  try {
    const [results] = await db.query(
      "SELECT ADMIN_ID, GR_EMPLOYER_LOGIN FROM admin"
    );
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Database error", details: err });
  }
});

// POST login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: "Missing credentials" });

  try {
    const [results] = await db.query(
      "SELECT ADMIN_ID, GR_EMPLOYER_LOGIN FROM admin_users WHERE ADMIN_ID = ? AND GR_EMPLOYER_LOGIN = ? LIMIT 1",
      [username, password]
    );

    if (results.length > 0) res.json({ success: true, user: results[0] });
    else res.status(401).json({ success: false, error: "Invalid credentials" });
  } catch (err) {
    res.status(500).json({ error: "Database error", details: err });
  }
});

/* ==========================
      🔍 SEARCH ENDPOINT
========================== */

app.get("/search", async (req, res) => {
  const query = req.query.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;

  if (!query) return res.status(400).json({ error: "Query is required" });

  const offset = (page - 1) * limit;

  try {
    const [results] = await db.query(
      `SELECT PATIENT_ID, PMR_NO, PATIENT_FNAME, GENDER, DISTRICT, DOB, MOBILE_NO,
              TIMESTAMPDIFF(YEAR, DOB, CURDATE()) AS AGE
       FROM prg_patient_reg
       WHERE PATIENT_ID LIKE ? OR PATIENT_FNAME LIKE ?
       LIMIT ? OFFSET ?`,
      [`%${query}%`, `%${query}%`, limit, offset]
    );
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Database error", details: err });
  }
});

/* ==========================
      🔍 PATIENTS ENDPOINTS
========================== */

app.get("/patients_all", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || "";
  const ward = req.query.ward || "";
  const branch = req.query.branch || "";
  const offset = (page - 1) * limit;

  try {
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
  } catch (err) {
    res.status(500).json({ error: "Database error", details: err });
  }
});

// GET single patient
app.get("/patients/:id", async (req, res) => {
  const patientId = req.params.id;
  try {
    const [results] = await db.query(
      "SELECT PATIENT_ID, PATIENT_FNAME, GENDER, DISTRICT, DOB, MOBILE_NO, TIMESTAMPDIFF(YEAR, DOB, CURDATE()) AS AGE FROM prg_patient_reg WHERE PATIENT_ID = ?",
      [patientId]
    );
    if (results.length === 0)
      return res.status(404).json({ error: "Patient not found" });
    res.json(results[0]);
  } catch (err) {
    res.status(500).json({ error: "Database error", details: err });
  }
});

/* ==========================
      🔹 PATIENT NOTES
========================== */

// GET patient notes
app.get("/patients/:id/notes", async (req, res) => {
  const id = req.params.id;
  try {
    const [results] = await db.query(
      `
      SELECT 
        Loc_ID,
        PATIENT_ID,
        COALESCE(LocalExamination, '') AS LocalExamination,
        DATE_FORMAT(loc_ex_date, '%Y-%m-%d %H:%i:%s') AS loc_ex_date,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
      FROM opd_local_examination
      WHERE PATIENT_ID = ?
      ORDER BY Loc_ID DESC
      `,
      [id]
    );
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Database error", details: err });
  }
});

// POST new patient note
app.post("/patients/:id/notes", async (req, res) => {
  const patientId = req.params.id;
  const { LocalExamination } = req.body;

  if (!LocalExamination)
    return res.status(400).json({ error: "LocalExamination is required" });

  try {
    const [result] = await db.query(
      "INSERT INTO opd_local_examination (PATIENT_ID, LocalExamination, loc_ex_date) VALUES (?, ?, NOW())",
      [patientId, LocalExamination]
    );
    res.json({ success: true, insertId: result.insertId });
  } catch (err) {
    res.status(500).json({ error: "Database error", details: err });
  }
});

/* ==========================
      LAB & RADIOLOGY
========================== */

app.get("/patients/:id/lab", async (req, res) => {
  const id = req.params.id;
  try {
    const [results] = await db.query(
      `SELECT o.Patient_ID, o.Order_Id, d.Barcode_no, r.id, r.LabNo, r.TestID, r.Result, r.NormalRange, r.Result_date_time
       FROM a_ordering o
       LEFT JOIN a_order_detail d ON o.Order_Id = d.Order_Id
       LEFT JOIN a_detailresultentry r ON d.Barcode_no = r.Barcode_no
       WHERE o.Patient_ID = ?
       ORDER BY r.Result_date_time DESC
       LIMIT 500`,
      [id]
    );
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Database error", details: err });
  }
});

app.get("/patients/:id/radiology", async (req, res) => {
  const patientId = req.params.id;
  try {
    const [results] = await db.query(
      `SELECT id, pmr_no, status, xray_status, ct_status, request_time,
              Priority AS priority, \`mod\` AS modality, mod_type, mod_region, short_history
       FROM tr_newris_request
       WHERE PATIENT_ID = ?
       ORDER BY id DESC`,
      [patientId]
    );
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Database error", details: err });
  }
});

/* ==========================
      WARD BEDS
========================== */

app.get("/ward_beds", async (req, res) => {
  try {
    const [results] = await db.query(
      "SELECT WARD_ID, WD_OCC_STATUS FROM ward_beds WHERE WARD_ID IN (921,1116,1119)"
    );
    const wardMapping = { 921: "PICU", 1116: "NICU", 1119: "GP" };
    const formatted = results.map((r) => ({
      ward: wardMapping[r.WARD_ID] || r.WARD_ID,
      status: r.WD_OCC_STATUS,
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: "Database error", details: err });
  }
});

/* ==========================
      COUNT RECORDS
========================== */

app.get("/tr_newris_request/count", async (req, res) => {
  try {
    const [results] = await db.query(
      "SELECT COUNT(*) AS total_count FROM tr_newris_request"
    );
    res.json(results[0]);
  } catch (err) {
    res.status(500).json({ error: "Database error", details: err });
  }
});

/* ==========================
      START SERVER
========================== */
const PORT = 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
