import React, {useState} from "react";
import axios from 'axios';
import styles from "./userinfo.module.css";
const CandidateProfileForm = () =>{
    const[formData, setFormData] = useState({
        FirstName:" ",
        MiddleName: " ",
        LastName: " ",
        Email: " ",
        PhoneNumber: " ",
        DateOfBirth: " ",
        Degree: " ",
        Major: " ",
        School:" ",
        StartDate: " ",
        EndDate: " ",
        CGPA: " ",
        Skills:" ",
        CompanyName: " ",
        JobName: " ",
        Description:" ",
        JobTittles: " ",


    });
    const API_BASE_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";
    const handleChange = (e) => {
        setFormData({...formData,[e.target.name]: e.target.value})
    };
    const handleSubmit = async(e) =>{
        e.preventDefault();
        try{
            const response = await axios.post(`${API_BASE_URL}/api/candidate`,formData,{
                headers: {'Content-Type' : 'application/json'} //defines the data inbeing sent in the  HTTP request  body is formatted as json.
            }); //..It tells server how to correctly parse and interpret the incoming data.
            alert('Profile updated Succesfully');
        }
        catch(err){
            console.error(err);
            alert("There was an error SAving the response.");
        }
    }
    return(
        <div className = {styles.candidateprofile}>
            <form onSubmit={handleSubmit}>
                <label>
                    FirstName:
                    <input type ="text" name="FirstName " value={formData.FullName} onChange={handleChange} required />
                </label>
                <br />
                <label>
                    MiddleName:
                    <input type ="text" name="MiddleName " value={formData.MiddleName} onChange={handleChange} required />
                </label>
                <br />
                <label>
                    LastName:
                    <input type ="text" name="LastName " value={formData.LastName} onChange={handleChange} required />
                </label>
                <br />
                <label>
                    Email:
                    <input type = "email" name="Email" value={formData.Email} onChange={handleChange} required />
                </label>
                <br />
                <label>
                    PhoneNumber:
                    <input type = "tel" name="PhoneNumber" value={formData.PhoneNumber} pattern = "[0-9]{10}" onChange={handleChange} required />
                </label>
                <br />
                <label>
                    DateOfBirth:
                    <input type = "date" name="DateOfBirth" value={formData.DateOfBirth} onChange={handleChange} required />
                </label>
                <br />
                <label>
                    Degree:
                    <input type = "text" name="Degree" value={formData.Degree} onChange={handleChange} required />
                </label>
                <br />
                <label>
                    Major:
                    <input type = "text" name="Major" value={formData.Major} onChange={handleChange} required />
                </label>
                <br />
                <label>
                    School:
                    <input type = "text" name="School" value={formData.School} onChange={handleChange} required />
                </label>
                <br />
                <label>
                    StartDate:
                    <input type = "date" name="StartDate" value={formData.StartDate} onChange={handleChange} required />
                </label>
                <br />
                <label>
                    EndDate:
                    <input type = "date" name="EndDate" value={formData.EndDate} onChange={handleChange} required />
                </label>
                <br />
                <label>
                    CGPA:
                    <input type = "number" name="CGPA" value={formData.CGPA} onChange={handleChange} required />
                </label>
                <br />
                <label>
                    Skills:
                    <textarea name = "skills"  value={formData.Skills} onChange={handleChange} required />
                </label>
                <br />
                <label>
                    CompanyName:
                    <input type = "text" name="CompanyName" value={formData.CompanyName} onChange={handleChange} required />
                </label>
                <br />
                <label>
                    JobName:
                    <input type = "text" name="JobName" value={formData.JobName} onChange={handleChange} required />
                </label>
                <br />
                <label>
                    Description:
                    < textarea name="Description" value={formData.Description} onChange={handleChange} required />
                </label>
                <br />
                <label>
                    Job Preferences:
                    < textarea name="JobTittles" value={formData.JobTittles} onChange={handleChange} required />
                </label>
                <br />
                <button type ="submit" calssName={styles.profilebutton} >Save Profile</button>


            </form>
        </div>
    );
};
export default CandidateProfileForm;