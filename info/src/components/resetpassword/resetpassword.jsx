import React, {useState} from "react";
import {useLocation, useNavigate} from 'react-router-dom';
import axios from "axios";
import styles from "./resetpassword.module.css";
const ResetPassword = () =>{
    const navigate = useNavigate();
    const { search } = useLocation();
    const[showConstraints, setShowConstraints] = useState(false);
    const[showPassword, setShowPassword] = useState(false);
    const[newPassword, setNewPassword] = useState("");
    const[confirmPassword, setConfirmPassword] = useState("");
    const[error, setError] = useState("");
    const[message, setMessage] = useState("");
    const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

    const passwordConstraints = [
        {
            label: 'At least 8 characters',
            test: (newPassword) => newPassword.length >=8,

        },
        {
            label: 'Need to have on upper case letter',
            test: (newPassword) => /[A-Z]/.test(newPassword),
        },
        {
            label: 'Need to have one Special Character',
            test: (newPassword) => /[!@#$%^&*(),.?{}|<>]/.test(newPassword),
        },
        {
            label: 'Need to have 1 digit',
            test: (newPassword) => /[0-9]/.test(newPassword),
        },

    ];
    const allConstraintsSatisfied = passwordConstraints.every(constraint => constraint.test(newPassword));
    const handleFocus = ()=>{
        setShowConstraints(true);
    }
    const handleBlur = () =>{
        // You need a small delay. So that the customer will click on the table if needed.
        setTimeout(()=>{
            setShowConstraints(false);
        },100);
    }

    //extracting token from query parameter, e.g, ?token=abcdef
    const queryParams= new URLSearchParams(search);
    const token = queryParams.get("token");
    

    const handleSubmit = async(e) =>{
        e.preventDefault();
        if(newPassword !== confirmPassword){
            setError("Passwords do not match");
            return;
        }
        try{
            //send post request to the backend to reset the password
            const response = await axios.post(`${API_BASE_URL}/api/reset_password`,{token,new_password: newPassword,});
            setMessage(response.data.msg);
            setError('');
            navigate("/")
    
        }
        catch(err){
            setError("Failes to reset the password. Please try again");
            setMessage('');
            setError(err);
            console.log(err);
        }

    };
    return(
        <div className={styles.resetpasswordcontainer}>
            <h2 className={styles.h2}>Reset Your Password</h2>
            <form onSubmit = {handleSubmit}>
                <div className={styles.newpasswordcontainer} style = {{position:'relative'}}>
                    <input type={showPassword?'text': 'password' } placeholder="Enter new Password" value={newPassword} onFocus={handleFocus} onBlur = {handleBlur} onChange={(e) =>setNewPassword(e.target.value)} required/>
                    <button type="button" className={styles.showpassword} onClick={()=>setShowPassword(!showPassword)}>{showPassword ? "🙈" : "👁️"}</button>
                    {showConstraints &&(
                        <div className={styles.constraintspopup} style={{visibility: allConstraintsSatisfied? "hidden":"visible"}}>
                            <ul className = {styles.constraintslist}>
                                {
                                    passwordConstraints.map((constraints,index) =>{
                                        const valid = constraints.test(newPassword);
                                        return(
                                            <li key={index} className={valid?styles.valid:styles.invalid}>
                                                {valid?'✓' : '✗'} {constraints.label}
                                            </li>
                                        )
                                    


                                    })
                                
                                }
                                
                
                            </ul>
                        </div>
                    )}

                </div>
                <div className={styles.confirmpassword}>
                    <input type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={(e) =>setConfirmPassword(e.target.value)}required/>
                    <button type = "submit">Reset Password</button>
                </div>
            </form>

              
                
            {message && <p className={styles.success}>{message}</p>}
            {error && <p className={styles.error}>{error.message}</p>}
        </div>
    );
};

export default ResetPassword;
