import React, { useState, useEffect } from "react";
import styles from "./userinfo.module.css";
import apiClient from "../../../axios.js";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

const blankEducation = () => ({
  degree: "",
  major: "",
  school: "",
  start_date: "",
  end_date: "",
  currently_studying: false,
  address: "",
  city: "",
  state: "",
  zip_code: "",
  country: "",
  cgpa: ""
});

const blankExperience = () => ({
  company_name: "",
  job_name: "",
  start_date: "",
  end_date: "",
  currently_working: false,
  address: "",
  city: "",
  state: "",
  zip_code: "",
  country: "",
  job_duties: ""
});

const defaultFormData = {
  // Personal
  first_name: "",
  middle_name: "",
  last_name: "",
  email: "",
  phone_number: "",
  date_of_birth: "",
  residence_address: "",
  residence_city: "",
  residence_state: "",
  residence_zip_code: "",
  residence_country: "",

  // Arrays
  educations: [blankEducation()],
  experiences: [blankExperience()],

  // Other
  skills: "",
  job_titles: "",
  linkedin: "",
  github: "",
  portfolio: "",
  resume: null,
  need_sponsorship: false,
  veteran: false,
  disability: false,
  locations: "",
  race: "",
  gender: ""
};

function sanitizeScalars(obj) {
  const out = {};
  Object.keys(obj).forEach((k) => {
    const v = obj[k];
    if (Array.isArray(v) || typeof v === "object") {
      out[k] = v; // handle below
    } else {
      out[k] = v === "" ? null : v;
    }
  });
  return out;
}

function sanitizeArray(arr) {
  // remove all-empty rows; convert "" to nulls
  return arr
    .map((row) => {
      const cleaned = {};
      Object.keys(row).forEach((k) => {
        const v = row[k];
        if (typeof v === "boolean") cleaned[k] = v;
        else cleaned[k] = v === "" ? null : v;
      });
      return cleaned;
    })
    .filter((row) => {
      // consider a row "empty" if all non-boolean fields are null/empty
      const keys = Object.keys(row);
      return keys.some((k) => typeof row[k] === "boolean" ? row[k] : row[k] !== null && row[k] !== "");
    });
}

function coerceBooleans(form) {
  return {
    ...form,
    need_sponsorship: !!form.need_sponsorship,
    veteran: !!form.veteran,
    disability: !!form.disability
  };
}

function backfillArraysFromLegacy(candidate) {
  // If backend currently returns legacy scalar education/experience, map them into arrays once.
  const educations = Array.isArray(candidate.educations) && candidate.educations.length
    ? candidate.educations
    : [{
        degree: candidate.degree || "",
        major: candidate.major || "",
        school: candidate.school || "",
        start_date: candidate.school_start_date || "",
        end_date: candidate.school_end_date || "",
        currently_studying: !!candidate.currently_studying,
        address: candidate.school_address || "",
        city: candidate.school_city || "",
        state: candidate.school_state || "",
        zip_code: candidate.school_zip_code || "",
        country: candidate.school_country || "",
        cgpa: candidate.cgpa || ""
      }];

  const experiences = Array.isArray(candidate.experiences) && candidate.experiences.length
    ? candidate.experiences
    : [{
        company_name: candidate.company_name || "",
        job_name: candidate.job_name || "",
        start_date: candidate.job_start_date || "",
        end_date: candidate.job_end_date || "",
        currently_working: !!candidate.currently_working,
        address: candidate.job_address || "",
        city: candidate.job_city || "",
        state: candidate.job_state || "",
        zip_code: candidate.job_zip_code || "",
        country: candidate.job_country || "",
        job_duties: candidate.job_duties || ""
      }];

  return { educations, experiences };
}

const CandidateProfileForm = () => {
  const [formData, setFormData] = useState(defaultFormData);
  const [resumePreviewUrl, setResumePreviewUrl] = useState(null);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchCandidate = async () => {
      try {
        const res = await apiClient.get("/api/candidate");
        if (!mounted) return;

        const base = { ...defaultFormData, ...res.data };
        const arrays = backfillArraysFromLegacy(res.data);
        const next = coerceBooleans({
          ...base,
          ...arrays
        });

        setFormData(next);

        if (res.data.resume) {
          const resumePath = res.data.resume.startsWith("/uploads")
            ? `${API_BASE_URL}${res.data.resume}`
            : res.data.resume;
          setResumePreviewUrl(resumePath);
        }
      } catch (err) {
        // 404 means new candidate – keep defaults
      } finally {
        if (mounted) setHasFetched(true);
      }
    };

    if (!hasFetched) fetchCandidate();
    return () => {
      mounted = false;
    };
  }, [hasFetched]);

  // ---------- Handlers: Personal / Other ----------
  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: type === "checkbox" ? checked : type === "file" ? files[0] : value };
      return next;
    });
    if (type === "file" && e.target.files?.[0]) {
      setResumePreviewUrl(URL.createObjectURL(e.target.files[0]));
    }
  };

  // ---------- Handlers: Dynamic Educations ----------
  const addEducation = () => {
    setFormData((p) => ({ ...p, educations: [...p.educations, blankEducation()] }));
  };
  const removeEducation = (idx) => {
    setFormData((p) => ({ ...p, educations: p.educations.filter((_, i) => i !== idx) }));
  };
  const changeEducation = (idx, key, value) => {
    setFormData((p) => {
      const arr = p.educations.slice();
      arr[idx] = { ...arr[idx], [key]: value };
      // Auto-clear end_date when currently_studying is true
      if (key === "currently_studying" && value) arr[idx].end_date = "";
      return { ...p, educations: arr };
    });
  };

  // ---------- Handlers: Dynamic Experiences ----------
  const addExperience = () => {
    setFormData((p) => ({ ...p, experiences: [...p.experiences, blankExperience()] }));
  };
  const removeExperience = (idx) => {
    setFormData((p) => ({ ...p, experiences: p.experiences.filter((_, i) => i !== idx) }));
  };
  const changeExperience = (idx, key, value) => {
    setFormData((p) => {
      const arr = p.experiences.slice();
      arr[idx] = { ...arr[idx], [key]: value };
      if (key === "currently_working" && value) arr[idx].end_date = "";
      return { ...p, experiences: arr };
    });
  };

  // ---------- Submit ----------
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let resumePath = null;

      if (formData.resume instanceof File) {
        const fd = new FormData();
        fd.append("file", formData.resume);
        const upload = await apiClient.post("/api/upload-resume", fd, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        resumePath = upload.data.resume;
      }

      // Build payload
      const scalars = sanitizeScalars({
        ...formData,
        resume: resumePath || formData.resume // if already a URL/path, keep it
      });

      const payload = {
        ...scalars,
        educations: sanitizeArray(formData.educations),
        experiences: sanitizeArray(formData.experiences)
      };

      // Optional: remove legacy single fields if your backend no longer needs them
      delete payload.degree;
      delete payload.major;
      delete payload.school;
      delete payload.school_start_date;
      delete payload.school_end_date;
      delete payload.school_address;
      delete payload.school_city;
      delete payload.school_state;
      delete payload.school_zip_code;
      delete payload.school_country;
      delete payload.cgpa;

      delete payload.company_name;
      delete payload.job_name;
      delete payload.job_start_date;
      delete payload.job_end_date;
      delete payload.job_address;
      delete payload.job_city;
      delete payload.job_state;
      delete payload.job_zip_code;
      delete payload.job_country;
      delete payload.job_duties;

      await apiClient.post("/api/candidate", payload);
      alert("Profile updated successfully.");
    } catch (err) {
      console.error(err);
      alert("There was an error saving your profile.");
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.candidateprofile}>
        <form onSubmit={handleSubmit} encType="multipart/form-data">
          <h2 className={styles.sectionTitle}>Personal Information</h2>

          <div className={styles.grid}>
            <label className={styles.srOnly} htmlFor="first_name">First Name</label>
            <input id="first_name" name="first_name" value={formData.first_name} onChange={handleChange} placeholder="First Name *" required />

            <label className={styles.srOnly} htmlFor="middle_name">Middle Name</label>
            <input id="middle_name" name="middle_name" value={formData.middle_name} onChange={handleChange} placeholder="Middle Name" />

            <label className={styles.srOnly} htmlFor="last_name">Last Name</label>
            <input id="last_name" name="last_name" value={formData.last_name} onChange={handleChange} placeholder="Last Name *" required />

            <label className={styles.srOnly} htmlFor="email">Email</label>
            <input id="email" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Email *" required />

            <label className={styles.srOnly} htmlFor="phone_number">Phone Number</label>
            <input id="phone_number" name="phone_number" value={formData.phone_number} onChange={handleChange} placeholder="Phone (10 digits) *" pattern="[0-9]{10}" required />

            <label className={styles.srOnly} htmlFor="date_of_birth">Date of Birth</label>
            <input id="date_of_birth" type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} />
          </div>

          <h2 className={styles.sectionTitle}>Residence</h2>
          <div className={styles.grid}>
            <input name="residence_address" value={formData.residence_address} onChange={handleChange} placeholder="Address" />
            <input name="residence_city" value={formData.residence_city} onChange={handleChange} placeholder="City" />
            <input name="residence_state" value={formData.residence_state} onChange={handleChange} placeholder="State" />
            <input name="residence_zip_code" value={formData.residence_zip_code} onChange={handleChange} placeholder="Zip Code" pattern="[0-9]*" />
            <input name="residence_country" value={formData.residence_country} onChange={handleChange} placeholder="Country" />
          </div>

          {/* ---------- EDUCATIONS (Dynamic) ---------- */}
          <div className={styles.sectionHeader}>
            <h2>Education</h2>
            <button type="button" className={styles.btnAdd} onClick={addEducation}>+ Add Education</button>
          </div>

          {formData.educations.map((edu, idx) => (
            <fieldset className={styles.repeatCard} key={`edu-${idx}`}>
              <legend className={styles.repeatLegend}>Education #{idx + 1}</legend>

              <div className={styles.grid}>
                <input placeholder="Degree" value={edu.degree} onChange={(e) => changeEducation(idx, "degree", e.target.value)} />
                <input placeholder="Major" value={edu.major} onChange={(e) => changeEducation(idx, "major", e.target.value)} />
                <input placeholder="School" value={edu.school} onChange={(e) => changeEducation(idx, "school", e.target.value)} />
                <input type="date" placeholder="Start Date" value={edu.start_date} onChange={(e) => changeEducation(idx, "start_date", e.target.value)} />
                <input type="date" placeholder="End Date" value={edu.currently_studying ? "" : edu.end_date} onChange={(e) => changeEducation(idx, "end_date", e.target.value)} disabled={edu.currently_studying} />

                <label className={styles.checkboxRow}>
                  <input type="checkbox" checked={!!edu.currently_studying} onChange={(e) => changeEducation(idx, "currently_studying", e.target.checked)} />
                  <span>Currently studying</span>
                </label>

                <input placeholder="Address" value={edu.address} onChange={(e) => changeEducation(idx, "address", e.target.value)} />
                <input placeholder="City" value={edu.city} onChange={(e) => changeEducation(idx, "city", e.target.value)} />
                <input placeholder="State" value={edu.state} onChange={(e) => changeEducation(idx, "state", e.target.value)} />
                <input placeholder="Zip Code" value={edu.zip_code} onChange={(e) => changeEducation(idx, "zip_code", e.target.value)} />
                <input placeholder="Country" value={edu.country} onChange={(e) => changeEducation(idx, "country", e.target.value)} />
                <input type="number" step="0.01" placeholder="CGPA" value={edu.cgpa} onChange={(e) => changeEducation(idx, "cgpa", e.target.value)} />
              </div>

              {formData.educations.length > 1 && (
                <button type="button" className={styles.btnRemove} onClick={() => removeEducation(idx)}>Remove</button>
              )}
            </fieldset>
          ))}

          {/* ---------- EXPERIENCES (Dynamic) ---------- */}
          <div className={styles.sectionHeader}>
            <h2>Work Experience</h2>
            <button type="button" className={styles.btnAdd} onClick={addExperience}>+ Add Experience</button>
          </div>

          {formData.experiences.map((exp, idx) => (
            <fieldset className={styles.repeatCard} key={`exp-${idx}`}>
              <legend className={styles.repeatLegend}>Experience #{idx + 1}</legend>

              <div className={styles.grid}>
                <input placeholder="Company Name" value={exp.company_name} onChange={(e) => changeExperience(idx, "company_name", e.target.value)} />
                <input placeholder="Job Title" value={exp.job_name} onChange={(e) => changeExperience(idx, "job_name", e.target.value)} />
                <input type="date" placeholder="Start Date" value={exp.start_date} onChange={(e) => changeExperience(idx, "start_date", e.target.value)} />
                <input type="date" placeholder="End Date" value={exp.currently_working ? "" : exp.end_date} onChange={(e) => changeExperience(idx, "end_date", e.target.value)} disabled={exp.currently_working} />

                <label className={styles.checkboxRow}>
                  <input type="checkbox" checked={!!exp.currently_working} onChange={(e) => changeExperience(idx, "currently_working", e.target.checked)} />
                  <span>Currently working here</span>
                </label>

                <input placeholder="Address" value={exp.address} onChange={(e) => changeExperience(idx, "address", e.target.value)} />
                <input placeholder="City" value={exp.city} onChange={(e) => changeExperience(idx, "city", e.target.value)} />
                <input placeholder="State" value={exp.state} onChange={(e) => changeExperience(idx, "state", e.target.value)} />
                <input placeholder="Zip Code" value={exp.zip_code} onChange={(e) => changeExperience(idx, "zip_code", e.target.value)} />
                <input placeholder="Country" value={exp.country} onChange={(e) => changeExperience(idx, "country", e.target.value)} />
                <textarea placeholder="Job Duties" value={exp.job_duties} onChange={(e) => changeExperience(idx, "job_duties", e.target.value)} />
              </div>

              {formData.experiences.length > 1 && (
                <button type="button" className={styles.btnRemove} onClick={() => removeExperience(idx)}>Remove</button>
              )}
            </fieldset>
          ))}

          {/* ---------- OTHER INFO ---------- */}
          <h2 className={styles.sectionTitle}>Other Information</h2>
          <div className={styles.grid}>
            <input type="url" name="linkedin" value={formData.linkedin} onChange={handleChange} placeholder="LinkedIn URL" />
            <input type="url" name="github" value={formData.github} onChange={handleChange} placeholder="GitHub URL" />
            <input name="race" value={formData.race} onChange={handleChange} placeholder="Race" />
            <input name="gender" value={formData.gender} onChange={handleChange} placeholder="Gender" />
            <label className={styles.fileLabel}>
              <span className={styles.fileText}>Resume (PDF/DOC/DOCX)</span>
              <input type="file" name="resume" accept=".pdf,.doc,.docx" onChange={handleChange} />
            </label>
            {resumePreviewUrl && (
              <a href={resumePreviewUrl} target="_blank" rel="noreferrer" className={styles.resumeLink}>
                View uploaded resume
              </a>
            )}
            <input type="url" name="portfolio" value={formData.portfolio} onChange={handleChange} placeholder="Portfolio URL" />

            <label className={styles.checkboxRow}>
              <input type="checkbox" name="need_sponsorship" checked={!!formData.need_sponsorship} onChange={handleChange} />
              <span>Need Sponsorship</span>
            </label>
            <label className={styles.checkboxRow}>
              <input type="checkbox" name="veteran" checked={!!formData.veteran} onChange={handleChange} />
              <span>Veteran</span>
            </label>
            <label className={styles.checkboxRow}>
              <input type="checkbox" name="disability" checked={!!formData.disability} onChange={handleChange} />
              <span>Disability</span>
            </label>
            <textarea name="skills" value={formData.skills} onChange={handleChange} placeholder="Skills (comma-separated or free text)"></textarea>
            <textarea name="job_titles" value={formData.job_titles} onChange={handleChange} placeholder="Job preferences / titles"></textarea>
            <textarea name="locations" value={formData.locations} onChange={handleChange} placeholder="Preferred locations"></textarea>
            <textarea name="message_to_hiring_manager" value={formData.message_to_hiring_manager} onChange={handleChange} placeholder='Message to Hiring Manager'></textarea>

          </div>
          <button type="submit" className={styles.primaryBtn} >Save Profile</button>
        </form>
      </div>
    </div>
  );
};

export default CandidateProfileForm;
