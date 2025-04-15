import { useNavigate } from "react-router-dom";
import React, {useContext} from 'react';
import {useState} from 'react';
//import axios from "axios";
import styles from './homepage.module.css';
import { AuthContext } from "../../authcontext"; //It is used when we are importing the element where it need to move 2 times upwards towards root dirrectory
import apiClient from "../../axios.js";
//../ moves to components, one more ../moves to src.



const HomePage = () =>{
    const navigate = useNavigate();
    //Syntax called as object destructing used to extract the user properties provided by the useContext(AuthContext).
    //const { user, logout} = useContext(AuthContext); //use usecontext hook to access values provided by the AuthContext.
    //const API_BASE_URL = Process.env.BACKEND_URL || "http://127.0.0.1:8000";
    const [activeTab, setActiveTab] = useState('tab1');
    const[isLoading,setIsLoading] = useState(false);
    //helper function to render content based on active tab.
    const handleTabClick = async(tab)=>{
        if(tab === 'tab3'){
            try{
                setIsLoading(true); // show loading feedback
                const response = await apiClient.post('/api/logout')
                console.log("Logout Successful" ,response.data);
                //await logout();
                navigate('/');
            }
            catch(error){
                const errorMessage = error?.response?.data?.detail || "Logout Failed";
                console.error('LogOut error:', errorMessage);
                alert(errorMessage);
            }
            finally{
                setIsLoading(false);
            }
        }
        else{
            setActiveTab(tab);
            switch(tab){
                case 'tab1':
                    navigate('/home');
                    break;
                case "tab2":
                    navigate('/profile')
                    break;
                default:
                    break;
    
            }

        }

    }
    return (
        <div className={styles.homepagebuttons}>
            <nav>
                <button onClick={()=>handleTabClick('tab1')}>Home</button>
                <button onClick={()=>handleTabClick('tab2')}>Profile</button>
                <button onClick={()=>handleTabClick('tab3')}>Logout</button>
            </nav>
            

        </div>
    );
};
export default HomePage;

    /*const handleLogout = async()=>{
        await logout;
        navigate('/');
    };
    
    const handleprofile = async() =>{
        navigate('/profile');
    };
      

    return(
        <div className={styles.homepagebuttons}>
            <div className={styles.logout}>
                <button onClick={handleLogout}>Logout</button>

            </div>
            <div className = {styles.profile}>
                <button onClick = {handleprofile}>Profile</button>
            </div>

        </div>
    );


}; */




