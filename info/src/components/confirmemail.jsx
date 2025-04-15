import React, {useState, useEffect} from 'react';
import {useLocation, useNavigate} from "react-router-dom";
import axios from "axios";

const ConfirmEmail = () =>{
    const[message, setMessage] = useState('');
    const[error, setError] = useState('');
    const navigate = useNavigate();
    const {search} = useLocation();
    const token = new URLSearchParams(search).get('token');
    const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";


    useEffect(() => {
        if(token){
            axios.post(`${API_BASE_URL}/api/confirm_email`,{token}).then(response =>{
                setMessage(response.data.msg);
                setError('');
                setTimeout(()=>{navigate('/');}, 3000);
                
            })
            .catch(err =>{
                setError(err.response?.data?.detail || "Email confirmation failes");
                setMessage('');
            });

        }
        else{
            setError("No token Provided");
        }
    }, [token, navigate]);

    return(
        <div>
            <h2>Your email was succesfully verified.</h2>
            {message && <p className = "success">{message}</p>}
            {error && <p className='error'>{error.message}</p>}
        </div>
    );
};
export default ConfirmEmail;