// src/App.js
import React from 'react';
//import {useEffect,useState} from 'react';
//import {useLocation, useNavigate} from "react-router-dom";
//import axios from "axios";
import {Routes, Route } from 'react-router-dom';
import LoginPage from './components/loginpage/loginpage.jsx';
import HomePage from'./components/homepage/homepage.jsx';
import CameraPage from './components/homepage/camerapage.jsx';
import AudioPage from './components/homepage/audiopage.jsx';
import ForgotPassword from './components/forgotpassword/forgotpassword.jsx';
import ResetPassword from "./components/resetpassword/resetpassword.jsx";
import {AuthProvider} from "./authcontext.js";
import ConfirmEmail from './components/confirmemail.jsx';
function App() {
  /* for token authentication */
  // const[user, setUser]= useState(null);
  //const navigate = useNavigate();
  //const location = useLocation();

    //only check auto-login if you are not in log-in page
    //if(location.pathname==="/") return;
    //This request includes credentials(cookies) so that the HTTPOnly token cookie is sent.


  return (
    <AuthProvider>
          
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/camera" element = {<CameraPage/>}/>
        <Route path = "/audio" element={<AudioPage/>}/>
        <Route path = "/forgotpassword" element={<ForgotPassword/>}/>
        <Route path = "/reset_password" element={<ResetPassword/>}/>
        <Route path = "/confirm_email" element = {<ConfirmEmail/>}/>
        {/* You can add more routes here as your app grows */}
      </Routes>

    </AuthProvider>


  );
}

export default App;
