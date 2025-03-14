import React, {useState} from "react";
import { useLocation,useNavigate } from "react-router-dom";
import axios from "axios";
import styles from"./forgotpassword.module.css";
import { toast } from "react-toastify/unstyled";
const ForgotPassword = ()=>{
    const [email, setEmail]= useState('');
    const [ message, setMessage]=useState('');
    const [error, setError]= useState('');
    const navigate = useNavigate();
    const[showResend, setShowResend]=useState(false)
    const[showSend, setShowSend]=useState(true)
    const API_BASE_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

    const handleSubmit = async(e) =>{
        e.preventDefault();
        try{
            const response = await axios.post("${API_BASE_URL}/api/forgot_password",{email});
            const msg=response?.data?.msg || "Password resent link sent";
            setMessage(msg);
            setError('');
            if(msg ==="Password resent link sent"){
                setShowResend(true);
                setShowSend(false);
            }
            

        } catch (err){
            const errorMessage = err.response?.data?.detail || "Failed to send reset link";
            setError(errorMessage);
            setMessage('');
            if (errorMessage ==="User does not exist")
                {
                    setShowResend(false);
                }
            else{
                setShowResend(false);
            }
         

        }

    };
    const handelResend= async() =>{
        try{
            const response = await axios.post("${API_BASE_URL}/api/resend_forgot_password",{email});
            const msg=response?.data?.msg || "Password resent link sent";
            setMessage(msg);
            setError('');
        }
        catch(err){
            const errorMessage = err.response?.data?.detail || "Failed to send reset link";
            setError(errorMessage);
            setMessage('');

        }
    }

    return(
        <div className={styles.forgotpassword}>
            <h2 className={styles.h2}>Forgot Password</h2>
            <form onSubmit={handleSubmit}>
                <h4 className={styles.h4}>Enter your Email</h4>
                <input type="email"  className={styles.in} placeholder="Email" value={email} onChange={(e)=> setEmail(e.target.value)} required />
                {showSend &&(<button type = "submit" className={styles.butt}>Send</button>)}
            </form>
            {message && <p className={styles.Success}>{message}</p>}
            {error && <p className={styles.error}>{error.message}</p>}
            {showResend &&
             (<button className={styles.butt} onClick={handelResend}>Resend</button>)}
        </div>


    );
};

export default ForgotPassword;