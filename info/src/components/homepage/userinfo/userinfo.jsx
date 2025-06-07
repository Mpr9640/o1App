import React, {useState,useEffect} from "react";
import axios from 'axios';
import styles from "./userinfo.module.css";
import apiClient from "../../../axios.js";
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const CandidateProfileForm = () =>{
    const defaultFormData={
        first_name:"",
        middle_name: "",
        last_name: "",
        email: "",
        phone_number: "",
        date_of_birth: "",
        residence_address:"",
        residence_city:"",
        residence_state:"",
        residence_zip_code:"",
        residence_country:"",
        degree: "",
        major: "",
        school:"",
        school_start_date: "",
        school_end_date: "",
        currently_studying:false,
        school_address:"",
        school_city:"",
        school_state:"",
        school_zip_code:"",
        school_country:"",
        cgpa: "",
        company_name: "",
        job_name: "",
        job_start_date:"",
        job_end_date:"",
        currently_working:false,
        job_address:"",
        job_city:"",
        job_state:"",
        job_zip_code:"",
        job_country:"",
        job_duties:"",
        skills:"",
        job_titles: "",
        linkedin:"",
        github:"",
        portfolio:"",
        resume:null,
        need_sponsorship:false,
        veteran: false,
        disability:false,
        locations:"",
        race:'',
        gender:'',
    };
    const[formData,setFormData]=useState(defaultFormData);
    
    const [isNewCandidate, setIsNewCandidate] = useState(false);
    //Flag to ensure we only fetch candidate data on mount.
    const [hasFetchedCandidate, setHasFetchedCandidate] = useState(false);
    const[resumePreviewUrl,setResumePreviewUrl] = useState(null);
    
    const sanitizePayload = (data) =>{
        const cleanedData = {};
        Object.keys(data).forEach(key=>{
            if(data[key]===""){
                cleanedData[key]=null;
            }
            else{
                cleanedData[key]=data[key];
            }
        })
        return cleanedData;
    }
    function sanitizeCandidateData(data){
        const cleaned = {...data};
        cleaned.github = cleaned.github || "";
        cleaned.linkedin = cleaned.linkedin || "";
        cleaned.phone_number = cleaned.phone_number || "";
        cleaned.job_address = cleaned.job_address || "";


        //Booleans( force false if null/defined)
        cleaned.disability = !!cleaned.disability;
        cleaned.need_sponsorship = !!cleaned.need_sponsorship;
        cleaned.veteran = !!cleaned.veteran;
        cleaned.currently_studying = !!cleaned.currently_studying;
        cleaned.currently_working = !!cleaned.currently_working;
        
        return cleaned;
    }
    
   //useEffect to fetch the candidate found on mount.
    useEffect(()=>{
        let isMounted = true;
        const fetchCandidate=async()=>{
            try{
                const response = await apiClient.get('/api/candidate');
                if (isMounted){
                    console.log("Received candidate data:", response.data)
                    setFormData({...defaultFormData, ...sanitizeCandidateData(response.data)}); //Assuming you're using useState
                    setIsNewCandidate(false);
                    if(response.data.resume){
                        const resumePath = response.data.resume.startsWith('/uploads')?`${API_BASE_URL}${response.data.resume}`:response.data.resume;
                        setResumePreviewUrl(resumePath);
                    }
    
                }
    
            

            }
    
            catch(error){
                if(isMounted){
                    //check if the error indicates that no candidate data exists(HTTP 404 unautorized)
                    if(error.response && error.response.status === 404){
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
    //const handleChange = (e) => {
        //setFormData({...formData,[e.target.name]: e.target.value});
    //};
    const handleChange=(e)=>{
        const{name,value,type,checked,files} = e.target;
        setFormData((prevFormData)=>({
            ...prevFormData,[name]: type === 'checkbox'? checked:(type==='file'?files[0]:value),
        }));
        if(type ==='file'&&files && files[0]){
            setResumePreviewUrl(URL.createObjectURL(files[0]));
        }
    };
    const handleSubmit = async(e) =>{
        e.preventDefault();
        try{
            let resumePath = null;
            //Step-1: Upload file seperately
            if(formData.resume instanceof File){
                const resumeForm = new FormData();
                resumeForm.append('file', formData.resume);
                const fileUploadRes = await apiClient.post("/api/upload-resume",resumeForm,{
                    headers:{
                        "Content-Type":"multipart/form-data",
                    },
                });
                resumePath = fileUploadRes.data.resume;
            }
       
            const full_name=`${formData.first_name} ${formData.middle_name} ${formData.last_name}`.trim();
    
            let payload = {
                 ...formData,
                 resume: resumePath,
                 full_name,

            }; 
            //sanitize data fields here:
            payload = sanitizePayload(payload);
            //Remove the raw file object before sending to JSON
            //delete payload.resumePreview;
           /* for(const key in formData){
                if(formData[key]!==null && formData[key]!==undefined){
                    if(typeof formData[key]==='boolean'){
                        payload.append(key,formData[key]?'true':'false');
                    }
                    else{
                        payload.append(key,formData[key]);
                    }
                }
            }*/
            const response = await apiClient.post('/api/candidate',payload);
            /*,{
                headers:{'Content-Type':'multipart/form-data',},//imp for file Uploading
            }); //..It tells server how to correctly parse and interpret the incoming data.
            */
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
     

    };
    return(
        <div className = {styles.candidateprofile}>
            <form onSubmit={handleSubmit} encType="multipart/form-data"> {/*Adding enc type for file uploads*/}
                <h2>Personal Information</h2>
                <label>
                    First Name:
                    <input type ="text" name="first_name" value={formData.first_name} onChange={handleChange} required />
                </label>               
                <label>
                    Middle Name:
                    <input type ="text" name="middle_name" value={formData.middle_name} onChange={handleChange}  />
                </label>
                <label>
                    Last Name:
                    <input type ="text" name="last_name" value={formData.last_name} onChange={handleChange} required />
                </label>               
                <label>
                    Email:
                    <input type = "email" name="email" value={formData.email} onChange={handleChange} required />
                </label>            
                <label>
                    Phone Number:
                    <input type = "tel" name="phone_number" value={formData.phone_number} pattern = "[0-9]{10}" onChange={handleChange} required />
                </label>               
                <label>
                    Date Of Birth:
                    <input type = "date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} required />
                </label> 
                <h2>Residence Address</h2>
                <label>
                    Address:
                    <input type="text" name="residence_address" value={formData.residence_address} onChange={handleChange} />
                </label>
                <label>
                    City:
                    <input type="text" name="residence_city" value={formData.residence_city} onChange={handleChange} />
                </label>
                <label>
                    State:
                    <input type="text" name="residence_state" value={formData.residence_state} onChange={handleChange} />
                </label> 
                <label>
                    Zip Code:
                    <input type="text" name="residence_zip_code"  pattern="[0-9]*" value={formData.residence_zip_code} onChange={handleChange} />
                </label> 
                <label>
                    Country:
                    <input type="text" name="residence_country" value={formData.residence_country} onChange={handleChange} />
                </label>
                <h2>Education</h2>           
                <label>
                    Degree:
                    <input type = "text" name="degree" value={formData.degree} onChange={handleChange} />
                </label>              
                <label>
                    Major:
                    <input type = "text" name="major" value={formData.major} onChange={handleChange} />
                </label>                
                <label>
                    School Name:
                    <input type = "text" name="school" value={formData.school} onChange={handleChange} />
                </label>           
                <label>
                    Start Date:
                    <input type = "date" name="school_start_date" value={formData.school_start_date} onChange={handleChange}  />
                </label>             
                <label>
                    End Date:
                    <input type = "date" name="school_end_date" value={formData.school_end_date} onChange={handleChange}  />
                </label>
                <label>
                    Currently Studying:
                    <input type = "checkbox" name ="currently_studying" checked={formData.currently_studying} onChange={(e)=>setFormData({...formData,currently_studying: e.target.checked})} />
                </label> 
                <label>
                    Address:
                    <input type = "text" name="school_address" value={formData.school_address} onChange={handleChange}  />
                </label>  
                <label>
                    city:
                    <input type = "text" name="school_city" value={formData.school_city} onChange={handleChange}/>
                </label> 
                <label>
                    state:
                    <input type = "text" name="school_state" value={formData.school_state} onChange={handleChange}  />
                </label> 
                <label>
                    Zip code:
                    <input type = "text" name="school_zip_code" pattern="[0-9]*" value={formData.school_zip_code} onChange={handleChange}  />
                </label> 
                <label>
                    Country:
                    <input type = "text" name="school_country" value={formData.school_country} onChange={handleChange}  />
                </label>             
                <label>
                    CGPA:
                    <input type = "number" name="cgpa" value={formData.cgpa} onChange={handleChange}  />
                </label>                
                <h2>Work Experience</h2>          
                <label>
                    Company Name:
                    <input type = "text" name="company_name" value={formData.company_name} onChange={handleChange} />
                </label>            
                <label>
                    Job Name:
                    <input type = "text" name="job_name" value={formData.job_name} onChange={handleChange}  />
                </label>
                <label>
                    Start date:
                    <input type = "date" name ="job_start_date" value={formData.job_start_date} onChange={handleChange} />
                </label>
                <label>
                    End date:
                    <input type = "date" name ="job_end_date" value={formData.job_end_date} onChange={handleChange}  />
                </label> 
                <label>
                    Currently Working Here:
                    <input type = "checkbox" name ="currently_working" checked={formData.currently_working} onChange={(e)=>setFormData({...formData,currently_working: e.target.checked})}  />
                </label>                
                <label>
                    Address:
                    <input type = "text" name ="job_address" value={formData.job_address} onChange={handleChange}  />
                </label> 
                <label>
                    City:
                    <input type = "text" name ="job_city" value={formData.job_city} onChange={handleChange} />
                </label> 
                <label>
                    State:
                    <input type = "text" name ="job_state" value={formData.job_state} onChange={handleChange} />
                </label> 
                <label>
                    Zip code:
                    <input type = "text" name ="job_zip_code" pattern="[0-9]*" value={formData.job_zip_code} onChange={handleChange} />
                </label> 
                <label>
                    Country:
                    <input type = "text" name ="job_country" value={formData.job_country} onChange={handleChange} />
                </label> 
                <label>
                    Job duties:
                    <textarea name="job_duties" value={formData.job_duties} onChange={handleChange} />
                </label>

                <h2>Other Information</h2>
                <label>
                    Skills:
                    <textarea name = "skills"  value={formData.skills} onChange={handleChange}  />
                </label> 
                <label>
                    Job Preferences:
                    < textarea name="job_titles" value={formData.job_titles} onChange={handleChange}  />
                </label>
                <label>
                    Linkedin:
                    <input type="url" name="linkedin" value={formData.linkedin} onChange={handleChange} />
                </label>
                <label>
                    Github:
                    <input type ="url" name='github' value={formData.github} onChange={handleChange}  />
                </label>
                <label>
                    Resume:
                    <input type="file" name='resume'  accept=".pdf,.doc,.docx" onChange={handleChange}  />
                    {resumePreviewUrl &&(
                        <div>
                            <p>Resume Preview:</p>
                            {/* might  want to display  a link or a basic preview if possible */}
                            {/* For security reasons, directly embedding might be restricted */}
                            <a href={resumePreviewUrl} target="_blank" rel="noopener noreferrer">View Resume</a>

                        </div>
                    )}
                </label>
                <label>
                    Need Sponsorship:
                    <input type="checkbox" name="need_sponsorship" checked={formData.need_sponsorship} onChange={(e)=>setFormData({...formData, need_sponsorship:e.target.checked})}/>
                </label>
                <label>
                    Veteran:
                    <input type="checkbox" name="veteran" checked={formData.veteran} onChange={(e)=>setFormData({...formData, veteran:e.target.checked})}/>
                </label>
                <label>
                    Disability:
                    <input type="checkbox" name="disability" checked={formData.disability} onChange={(e)=>setFormData({...formData, disability:e.target.checked})}/>
                </label>
                <label>
                    Preferred Locations:
                    <textarea name="locations" value={formData.locations} onChange={handleChange}/>
                </label>
                <label>
                    Race:
                    <input type="text" name= "race" value={formData.race} onChange={handleChange} />
                </label>
                <label>
                    Gender:
                    <input type="text" name='gender' value={formData.gender} onChange={handleChange} />
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