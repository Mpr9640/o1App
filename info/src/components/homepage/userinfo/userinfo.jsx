import React, {useState,useEffect} from "react";
import axios from 'axios';
import styles from "./userinfo.module.css";
import apiClient from "../../../axios.js";
const CandidateProfileForm = () =>{
    const[formData, setFormData] = useState({
        first_name:"",
        middle_name: "",
        last_name: "",
        email: "",
        phone_number: "",
        date_of_birth: "",
        degree: "",
        major: "",
        school:"",
        start_date: "",
        end_date: "",
        cgpa: "",
        skills:"",
        company_name: "",
        job_name: "",
        description:"",
        job_titles: "",


    });
    
    const [isNewCandidate, setIsNewCandidate] = useState(false);
    //Flag to ensure we only fetch candidate data on mount.
    const [hasFetchedCandidate, setHasFetchedCandidate] = useState(false);
    
   //useEffect to fetch the candidate found on mount.
    useEffect(()=>{
        let isMounted = true;
        const fetchCandidate=async()=>{
            try{
                const response = await apiClient.get('/api/candidate');
                if (isMounted){
                    console.log("Received candidate data:", response.data)
                    setFormData(response.data); //Assuming you're using useState
                    setIsNewCandidate(false);
    
                }
    
            

            }
    
            catch(error){
                if(isMounted){
                    //check if the error indicates that no candidate data exists(HTTP 404 unautorized)
                    if(error.response && error.response.status === 401){
                        console.log('New candidate')
                        setIsNewCandidate(true);
                    }
                    else{
                        console.error("Error fetching canidate data:", error);
    
                    }
                    
    
                }
                
            }
            finally{
                if(isMounted){
                    setHasFetchedCandidate(true);
                }

            }
                   
        }

        if(!hasFetchedCandidate){
            fetchCandidate();
        }
        return () =>{isMounted = false}; //cleanup flag


    },[hasFetchedCandidate]);
    const handleChange = (e) => {
        setFormData({...formData,[e.target.name]: e.target.value});
    };
    const handleSubmit = async(e) =>{
        e.preventDefault();
        const full_name=`${formData.first_name} ${formData.middle_name} ${formData.last_name}`.trim();
    
        const payload = {
            ...formData,
            full_name,

        }; 
        try{
            const response = await apiClient.post('/api/candidate',payload); //..It tells server how to correctly parse and interpret the incoming data.
            alert('Profile updated Succesfully');
        }
        catch(err){
            if(err.response){
                console.error('Error',err.response.data);
                alert("There was an error Saving the response.");

            }
            else{
                console.error("Error", err);
                alert("AN unknown error occured.");
            }
           
        }
     

    }
    return(
        <div className = {styles.candidateprofile}>
            <form onSubmit={handleSubmit}>
                <label>
                    FirstName:
                    <input type ="text" name="first_name" value={formData.first_name} onChange={handleChange} required />
                </label>               
                <label>
                    MiddleName:
                    <input type ="text" name="middle_name" value={formData.middle_name} onChange={handleChange}  />
                </label>
                <label>
                    LastName:
                    <input type ="text" name="last_name" value={formData.last_name} onChange={handleChange} required />
                </label>               
                <label>
                    Email:
                    <input type = "email" name="email" value={formData.email} onChange={handleChange} required />
                </label>            
                <label>
                    PhoneNumber:
                    <input type = "tel" name="phone_number" value={formData.phone_number} pattern = "[0-9]{10}" onChange={handleChange} required />
                </label>               
                <label>
                    DateOfBirth:
                    <input type = "date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} required />
                </label>          
                <label>
                    Degree:
                    <input type = "text" name="degree" value={formData.degree} onChange={handleChange} required />
                </label>              
                <label>
                    Major:
                    <input type = "text" name="major" value={formData.major} onChange={handleChange} required />
                </label>                
                <label>
                    School:
                    <input type = "text" name="school" value={formData.school} onChange={handleChange} required />
                </label>           
                <label>
                    StartDate:
                    <input type = "date" name="start_date" value={formData.start_date} onChange={handleChange} required />
                </label>             
                <label>
                    EndDate:
                    <input type = "date" name="end_date" value={formData.end_date} onChange={handleChange} required />
                </label>              
                <label>
                    CGPA:
                    <input type = "number" name="cgpa" value={formData.cgpa} onChange={handleChange} required />
                </label>                
                <label>
                    Skills:
                    <textarea name = "skills"  value={formData.skills} onChange={handleChange} required />
                </label>           
                <label>
                    CompanyName:
                    <input type = "text" name="company_name" value={formData.company_name} onChange={handleChange} required />
                </label>            
                <label>
                    JobName:
                    <input type = "text" name="job_name" value={formData.job_name} onChange={handleChange} required />
                </label>               
                <label>
                    Description:
                    < textarea name="description" value={formData.description} onChange={handleChange} required />
                </label>
                <label>
                    Job Preferences:
                    < textarea name="job_titles" value={formData.job_titles} onChange={handleChange} required />
                </label>
                <button type ="submit" className={styles.profilebutton} >Save Profile</button>


            </form>
        </div>
    );
};
export default CandidateProfileForm;

      /* Helper function to convert mm-dd-yyyy to yyyy-mm-dd
        function convertToISO(datestr){
        //Ensure datestr is in the expected format, e.g; "12-31-2025"
        const [month, day, year] = datestr.split('-');
        const mm= String(month).padStart(2,"0");
        const dd = String(day).padStart(2,'0');
        //optionlayy , you can add validations to ensure month, day, and year are valid.
        //return `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
        return `${year}-${mm}-${dd}`;
    }*/
               /*date_of_birth: isoDateOfBirth,
            start_date: isoStartDate,
            end_date:isoEndDate,*/
            //cgpa:cgpaNumber, 
                /*const isoDateOfBirth = convertToISO(formData.date_of_birth);
        const isoStartDate = convertToISO(formData.start_date);
        const isoEndDate = convertToISO(formData.end_date); */

        //converting cgpa to a number if needed
        /*const cgpaNumber = parseFloat(formData.cgpa);
        if(isNaN(cgpaNumber)){
            alert('Please enter a vaild number for CGPA');
            return;
        } */
        //Building the payload with the ISO dates.
        /*useEffect(() => {
            const saved=localStorage.getItem('authToken');
            if(saved){
                setToken(saved);
                console.log('candidatetokensaved');
            }
            else{
                console.log('NoCandidatetokensaved');
            }
        },[]);*/
        //const[token,setToken] = useState(null);

   // const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000";