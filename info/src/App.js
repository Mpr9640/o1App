// src/App.js
import React from 'react';
//import {useEffect,useState} from 'react';
//import {useLocation, useNavigate} from "react-router-dom";
//import axios from "axios";
import {Routes, Route } from 'react-router-dom';
import LoginPage from './components/loginpage/loginpage.jsx';
import HomePage from'./components/homepage/homepage.jsx';
import ForgotPassword from './components/forgotpassword/forgotpassword.jsx';
import ResetPassword from "./components/resetpassword/resetpassword.jsx";
import {AuthProvider} from "./authcontext.js";
import ConfirmEmail from './components/confirmemail.jsx';
import CandidateProfileForm from './components/homepage/userinfo/userinfo.jsx';
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
        <Route path = "/forgotpassword" element={<ForgotPassword/>}/>
        <Route path = "/reset_password" element={<ResetPassword/>}/>
        <Route path = "/confirm_email" element = {<ConfirmEmail/>}/>
        <Route path = "/profile" element = {<CandidateProfileForm/>}/>
        {/* You can add more routes here as your app grows */}
      </Routes>

    </AuthProvider>


  );
}

export default App;
