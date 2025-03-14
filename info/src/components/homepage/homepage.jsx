import { useNavigate } from "react-router-dom";
import React, {useContext} from 'react';
//import axios from "axios";
import styles from './homepage.module.css';
import { AuthContext } from "../../authcontext"; //It is used when we are importing the element where it need to move 2 times upwards towards root dirrectory
//../ moves to components, one more ../moves to src.
const HomePage = () =>{
    const navigate = useNavigate();
    //Syntax called as object destructing used to extract the user properties provided by the useContext(AuthContext).
    const { user, logout} = useContext(AuthContext); //use usecontext hook to access values provided by the AuthContext.
    const API_BASE_URL = Process.env.BACKEND_URL || "http://127.0.0.1:8000";


    const handleLogout = async()=>{
        await logout;
        navigate('/');
    };
    const handleImportPhoto = (event)=>{
        const file = event.target.files[0];
        if(file){
            alert('Selected file: ${file.name}');
            //you can process the image here means uploadign it into the server.
        }

    };

    const handleTakePhoto=()=>{
        navigate('/camera'); //Redirected to camera page.
    };

    const handleRecordedAudio = () =>{
        navigate('/audio');
    }
    /*const handleAudioUpload=(e)=>{
        if(file){
            alert('Selected file: ${file.name}');
        }
    }; */

    return(
    <div>
        <div className={styles.logout}>
            <button onClick={handleLogout}>Logout</button>

        </div>
        <div className={styles.homepage}>
            <h1>Welcome to homepage</h1>
            <div className = {styles.photoimport}>
                <label htmlFor='uploadphoto'>
                    <input type="file" accept='image/*' id="uploadphoto" style={{display:'none'}} onChange={handleImportPhoto}/>


                </label>
                <button>Import Photo</button>
            </div>
            <div className={styles.takephoto}>
                <button onClick={handleTakePhoto}>Take Photo</button>
            </div>
            <div className={styles.recordaudio}>
                <button onClick={handleRecordedAudio}>Record/Upload Audio</button>
            </div>

        </div>

    </div>
        
    );


};


export default HomePage;