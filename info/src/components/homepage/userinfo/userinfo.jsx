import React, { useState, useEffect } from "react";
import styles from "./userinfo.module.css";
import apiClient from "../../../axios.js";
import { useOutletContext } from 'react-router-dom';
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

/* ---------- small helper so we don't repeat label+input markup ---------- */
const Field = ({ id, label, children, required = false, hint }) => (
  <label className={styles.field} htmlFor={id}>
    <span className={styles.label}>
      {label}
      {required && <span aria-hidden="true" style={{ color: "#d12c2c", marginLeft: 4 }}>*</span>}
    </span>
    {children}
    {hint && <span className={styles.hint}>{hint}</span>}
  </label>
);

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
  gender: "",
  message_to_hiring_manager: ""
};

function sanitizeScalars(obj) {
  const out = {};
  Object.keys(obj).forEach((k) => {
    const v = obj[k];
    if (Array.isArray(v) || typeof v === "object") {
      out[k] = v;
    } else {
      out[k] = v === "" ? null : v;
    }
  });
  return out;
}

function sanitizeArray(arr) {
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
      const keys = Object.keys(row);
      return keys.some((k) =>
        typeof row[k] === "boolean" ? row[k] : row[k] !== null && row[k] !== ""
      );
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
  const educations =
    Array.isArray(candidate.educations) && candidate.educations.length
      ? candidate.educations
      : [
          {
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
          }
        ];

  const experiences =
    Array.isArray(candidate.experiences) && candidate.experiences.length
      ? candidate.experiences
      : [
          {
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
          }
        ];

  return { educations, experiences };
}

const CandidateProfileForm = () => {
  const [formData, setFormData] = useState(defaultFormData);
  const [resumePreviewUrl, setResumePreviewUrl] = useState(null);
  const [hasFetched, setHasFetched] = useState(false);
  const { showAlert } = useOutletContext?.() || { showAlert: null };


  useEffect(() => {
    let mounted = true;
    const fetchCandidate = async () => {
      try {
        const res = await apiClient.get("/api/candidate");
        if (!mounted) return;

        const base = { ...defaultFormData, ...res.data };
        const arrays = backfillArraysFromLegacy(res.data);
        const next = coerceBooleans({ ...base, ...arrays });

        setFormData(next);

        if (res.data.resume) {
          const resumePath = res.data.resume.startsWith("/uploads")
            ? `${API_BASE_URL}${res.data.resume}`
            : res.data.resume;
          setResumePreviewUrl(resumePath);
        }
      } catch {
        /* 404 okay */
      } finally {
        if (mounted) setHasFetched(true);
      }
    };

    if (!hasFetched) fetchCandidate();
    return () => {
      mounted = false;
    };
  }, [hasFetched]);

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    setFormData((prev) => {
      const next = {
        ...prev,
        [name]: type === "checkbox" ? checked : type === "file" ? files[0] : value
      };
      return next;
    });
    if (type === "file" && e.target.files?.[0]) {
      setResumePreviewUrl(URL.createObjectURL(e.target.files[0]));
    }
  };

  // dynamic arrays
  const addEducation = () => setFormData((p) => ({ ...p, educations: [...p.educations, blankEducation()] }));
  const removeEducation = (idx) =>
    setFormData((p) => ({ ...p, educations: p.educations.filter((_, i) => i !== idx) }));
  const changeEducation = (idx, key, value) =>
    setFormData((p) => {
      const arr = p.educations.slice();
      arr[idx] = { ...arr[idx], [key]: value };
      if (key === "currently_studying" && value) arr[idx].end_date = "";
      return { ...p, educations: arr };
    });

  const addExperience = () => setFormData((p) => ({ ...p, experiences: [...p.experiences, blankExperience()] }));
  const removeExperience = (idx) =>
    setFormData((p) => ({ ...p, experiences: p.experiences.filter((_, i) => i !== idx) }));
  const changeExperience = (idx, key, value) =>
    setFormData((p) => {
      const arr = p.experiences.slice();
      arr[idx] = { ...arr[idx], [key]: value };
      if (key === "currently_working" && value) arr[idx].end_date = "";
      return { ...p, experiences: arr };
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    //const { showAlert } = useOutletContext();
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

      const scalars = sanitizeScalars({
        ...formData,
        resume: resumePath || formData.resume
      });

      const payload = {
        ...scalars,
        educations: sanitizeArray(formData.educations),
        experiences: sanitizeArray(formData.experiences)
      };

      // drop legacy singles
      delete payload.degree; delete payload.major; delete payload.school;
      delete payload.school_start_date; delete payload.school_end_date;
      delete payload.school_address; delete payload.school_city; delete payload.school_state;
      delete payload.school_zip_code; delete payload.school_country; delete payload.cgpa;
      delete payload.company_name; delete payload.job_name; delete payload.job_start_date;
      delete payload.job_end_date; delete payload.job_address; delete payload.job_city;
      delete payload.job_state; delete payload.job_zip_code; delete payload.job_country;
      delete payload.job_duties;

      await apiClient.post("/api/candidate", payload);
      //showAlert("Profile updated successfully.");
      showAlert?.({ title: "Saved", message: "Profile updated successfully." });
    } catch (err) {
      //console.error(err);
      //showAlert("There was an error saving your profile.");
    showAlert?.({
      title: "Save failed",
      message: err?.response?.data?.detail || err?.message || "Something went wrong",
    });

    }   
  };

  return (
    <div className={styles.page}>
      <div className={styles.candidateprofile}>
        <form onSubmit={handleSubmit} encType="multipart/form-data">
          <h2 className={styles.sectionTitle}>Personal Information</h2>

          <div className={styles.grid}>
            <Field id="first_name" label="First Name" required>
              <input id="first_name" name="first_name" value={formData.first_name} onChange={handleChange} required />
            </Field>

            <Field id="middle_name" label="Middle Name">
              <input id="middle_name" name="middle_name" value={formData.middle_name} onChange={handleChange} />
            </Field>

            <Field id="last_name" label="Last Name" required>
              <input id="last_name" name="last_name" value={formData.last_name} onChange={handleChange} required />
            </Field>

            <Field id="email" label="Email" required>
              <input id="email" type="email" name="email" value={formData.email} onChange={handleChange} required />
            </Field>

            <Field id="phone_number" label="Phone (10 digits)" required>
              <input id="phone_number" name="phone_number" value={formData.phone_number} onChange={handleChange} pattern="[0-9]{10}" required />
            </Field>

            <Field id="date_of_birth" label="Date of Birth">
              <input id="date_of_birth" type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} />
            </Field>
          </div>

          <h2 className={styles.sectionTitle}>Residence</h2>
          <div className={styles.grid}>
            <Field id="residence_address" label="Address">
              <input id="residence_address" name="residence_address" value={formData.residence_address} onChange={handleChange} />
            </Field>
            <Field id="residence_city" label="City">
              <input id="residence_city" name="residence_city" value={formData.residence_city} onChange={handleChange} />
            </Field>
            <Field id="residence_state" label="State">
              <input id="residence_state" name="residence_state" value={formData.residence_state} onChange={handleChange} />
            </Field>
            <Field id="residence_zip_code" label="Zip Code">
              <input id="residence_zip_code" name="residence_zip_code" value={formData.residence_zip_code} onChange={handleChange} pattern="[0-9]*" />
            </Field>
            <Field id="residence_country" label="Country">
              <input id="residence_country" name="residence_country" value={formData.residence_country} onChange={handleChange} />
            </Field>
          </div>

          {/* ---------- EDUCATION ---------- */}
          <div className={styles.sectionHeader}>
            <h2>Education</h2>
            <button type="button" className={styles.btnAdd} onClick={addEducation}>+ Add Education</button>
          </div>

          {formData.educations.map((edu, idx) => (
            <fieldset className={styles.repeatCard} key={`edu-${idx}`}>
              <legend className={styles.repeatLegend}>Education #{idx + 1}</legend>
              <div className={styles.grid}>
                <Field id={`edu_degree_${idx}`} label="Degree">
                  <input id={`edu_degree_${idx}`} value={edu.degree} onChange={(e) => changeEducation(idx, "degree", e.target.value)} />
                </Field>
                <Field id={`edu_major_${idx}`} label="Major">
                  <input id={`edu_major_${idx}`} value={edu.major} onChange={(e) => changeEducation(idx, "major", e.target.value)} />
                </Field>
                <Field id={`edu_school_${idx}`} label="School">
                  <input id={`edu_school_${idx}`} value={edu.school} onChange={(e) => changeEducation(idx, "school", e.target.value)} />
                </Field>
                <Field id={`edu_start_${idx}`} label="Start Date">
                  <input id={`edu_start_${idx}`} type="date" value={edu.start_date} onChange={(e) => changeEducation(idx, "start_date", e.target.value)} />
                </Field>
                <Field id={`edu_end_${idx}`} label="End Date">
                  <input
                    id={`edu_end_${idx}`}
                    type="date"
                    value={edu.currently_studying ? "" : edu.end_date}
                    onChange={(e) => changeEducation(idx, "end_date", e.target.value)}
                    disabled={edu.currently_studying}
                  />
                </Field>

                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={!!edu.currently_studying}
                    onChange={(e) => changeEducation(idx, "currently_studying", e.target.checked)}
                  />
                  <span>Currently studying</span>
                </label>

                <Field id={`edu_address_${idx}`} label="Address">
                  <input id={`edu_address_${idx}`} value={edu.address} onChange={(e) => changeEducation(idx, "address", e.target.value)} />
                </Field>
                <Field id={`edu_city_${idx}`} label="City">
                  <input id={`edu_city_${idx}`} value={edu.city} onChange={(e) => changeEducation(idx, "city", e.target.value)} />
                </Field>
                <Field id={`edu_state_${idx}`} label="State">
                  <input id={`edu_state_${idx}`} value={edu.state} onChange={(e) => changeEducation(idx, "state", e.target.value)} />
                </Field>
                <Field id={`edu_zip_${idx}`} label="Zip Code">
                  <input id={`edu_zip_${idx}`} value={edu.zip_code} onChange={(e) => changeEducation(idx, "zip_code", e.target.value)} />
                </Field>
                <Field id={`edu_country_${idx}`} label="Country">
                  <input id={`edu_country_${idx}`} value={edu.country} onChange={(e) => changeEducation(idx, "country", e.target.value)} />
                </Field>
                <Field id={`edu_cgpa_${idx}`} label="CGPA">
                  <input id={`edu_cgpa_${idx}`} type="number" step="0.01" value={edu.cgpa} onChange={(e) => changeEducation(idx, "cgpa", e.target.value)} />
                </Field>
              </div>

              {formData.educations.length > 1 && (
                <button type="button" className={styles.btnRemove} onClick={() => removeEducation(idx)}>Remove</button>
              )}
            </fieldset>
          ))}

          {/* ---------- EXPERIENCE ---------- */}
          <div className={styles.sectionHeader}>
            <h2>Work Experience</h2>
            <button type="button" className={styles.btnAdd} onClick={addExperience}>+ Add Experience</button>
          </div>

          {formData.experiences.map((exp, idx) => (
            <fieldset className={styles.repeatCard} key={`exp-${idx}`}>
              <legend className={styles.repeatLegend}>Experience #{idx + 1}</legend>
              <div className={styles.grid}>
                <Field id={`exp_company_${idx}`} label="Company Name">
                  <input id={`exp_company_${idx}`} value={exp.company_name} onChange={(e) => changeExperience(idx, "company_name", e.target.value)} />
                </Field>
                <Field id={`exp_title_${idx}`} label="Job Title">
                  <input id={`exp_title_${idx}`} value={exp.job_name} onChange={(e) => changeExperience(idx, "job_name", e.target.value)} />
                </Field>
                <Field id={`exp_start_${idx}`} label="Start Date">
                  <input id={`exp_start_${idx}`} type="date" value={exp.start_date} onChange={(e) => changeExperience(idx, "start_date", e.target.value)} />
                </Field>
                <Field id={`exp_end_${idx}`} label="End Date">
                  <input
                    id={`exp_end_${idx}`}
                    type="date"
                    value={exp.currently_working ? "" : exp.end_date}
                    onChange={(e) => changeExperience(idx, "end_date", e.target.value)}
                    disabled={exp.currently_working}
                  />
                </Field>

                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={!!exp.currently_working}
                    onChange={(e) => changeExperience(idx, "currently_working", e.target.checked)}
                  />
                  <span>Currently working here</span>
                </label>

                <Field id={`exp_address_${idx}`} label="Address">
                  <input id={`exp_address_${idx}`} value={exp.address} onChange={(e) => changeExperience(idx, "address", e.target.value)} />
                </Field>
                <Field id={`exp_city_${idx}`} label="City">
                  <input id={`exp_city_${idx}`} value={exp.city} onChange={(e) => changeExperience(idx, "city", e.target.value)} />
                </Field>
                <Field id={`exp_state_${idx}`} label="State">
                  <input id={`exp_state_${idx}`} value={exp.state} onChange={(e) => changeExperience(idx, "state", e.target.value)} />
                </Field>
                <Field id={`exp_zip_${idx}`} label="Zip Code">
                  <input id={`exp_zip_${idx}`} value={exp.zip_code} onChange={(e) => changeExperience(idx, "zip_code", e.target.value)} />
                </Field>
                <Field id={`exp_country_${idx}`} label="Country">
                  <input id={`exp_country_${idx}`} value={exp.country} onChange={(e) => changeExperience(idx, "country", e.target.value)} />
                </Field>

                <Field id={`exp_duties_${idx}`} label="Job Duties">
                  <textarea id={`exp_duties_${idx}`} value={exp.job_duties} onChange={(e) => changeExperience(idx, "job_duties", e.target.value)} />
                </Field>
              </div>

              {formData.experiences.length > 1 && (
                <button type="button" className={styles.btnRemove} onClick={() => removeExperience(idx)}>Remove</button>
              )}
            </fieldset>
          ))}

          {/* ---------- OTHER INFO ---------- */}
          <h2 className={styles.sectionTitle}>Other Information</h2>
          <div className={styles.grid}>
            <Field id="linkedin" label="LinkedIn URL">
              <input id="linkedin" type="url" name="linkedin" value={formData.linkedin} onChange={handleChange} />
            </Field>
            <Field id="github" label="GitHub URL">
              <input id="github" type="url" name="github" value={formData.github} onChange={handleChange} />
            </Field>
            <Field id="race" label="Race">
              <input id="race" name="race" value={formData.race} onChange={handleChange} />
            </Field>
            <Field id="gender" label="Gender">
              <input id="gender" name="gender" value={formData.gender} onChange={handleChange} />
            </Field>

            <label className={styles.fileLabel}>
              <span className={styles.fileText}>Resume (PDF/DOC/DOCX)</span>
              <input type="file" name="resume" accept=".pdf,.doc,.docx" onChange={handleChange} />
            </label>
            {resumePreviewUrl && (
              <a href={resumePreviewUrl} target="_blank" rel="noreferrer" className={styles.resumeLink}>
                View uploaded resume
              </a>
            )}

            <Field id="portfolio" label="Portfolio URL">
              <input id="portfolio" type="url" name="portfolio" value={formData.portfolio} onChange={handleChange} />
            </Field>

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

            <Field id="skills" label="Skills">
              <textarea id="skills" name="skills" value={formData.skills} onChange={handleChange} />
            </Field>
            <Field id="job_titles" label="Job Preferences / Titles">
              <textarea id="job_titles" name="job_titles" value={formData.job_titles} onChange={handleChange} />
            </Field>
            <Field id="locations" label="Preferred Locations">
              <textarea id="locations" name="locations" value={formData.locations} onChange={handleChange} />
            </Field>
            <Field id="message_to_hiring_manager" label="Message to Hiring Manager">
              <textarea
                id="message_to_hiring_manager"
                name="message_to_hiring_manager"
                value={formData.message_to_hiring_manager || ""}
                onChange={handleChange}
              />
            </Field>
          </div>

          <button type="submit" className={styles.primaryBtn}>Save Profile</button>
        </form>
      </div>
    </div>
  );
};

export default CandidateProfileForm;
