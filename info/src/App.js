// src/App.js
import React from 'react';
//import {useEffect,useState} from 'react';
//import {useLocation, useNavigate} from "react-router-dom";
//import axios from "axios";
import {Routes, Route,Navigate } from 'react-router-dom';
import LoginPage from './components/loginpage/loginpage.jsx';
import HomePage from'./components/homepage/homepage.jsx';
import ForgotPassword from './components/forgotpassword/forgotpassword.jsx';
import ResetPassword from "./components/resetpassword/resetpassword.jsx";
//import {AuthProvider} from "./authcontext.js";
import ConfirmEmail from './components/confirmemail.jsx';
import CandidateProfileForm from './components/homepage/userinfo/userinfo.jsx';
import AppLayout from './layout/applayout.jsx';
import AuthLayout from './layout/authlayout.jsx';
import AppliedJobsPage from "./pages/appliedjobs";
// ...
function App() {
  /* for token authentication */
  // const[user, setUser]= useState(null);
  //const navigate = useNavigate();
  //const location = useLocation();

    //only check auto-login if you are not in log-in page
    //if(location.pathname==="/") return;
    //This request includes credentials(cookies) so that the HTTPOnly token cookie is sent.


  return (
      <Routes>
        <Route element = {<AppLayout/>}>
          <Route path="/home" element={<HomePage />} />
          <Route path = "/profile" element = {<CandidateProfileForm/>}/> 
          <Route path="/applied-jobs" element={<AppliedJobsPage />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>
        <Route element = {<AuthLayout/>}>
          <Route path="/" element={<LoginPage />} />
          <Route path = "/forgotpassword" element={<ForgotPassword/>}/>
          <Route path = "/reset_password" element={<ResetPassword/>}/>
          <Route path = "/confirm_email" element = {<ConfirmEmail/>}/>
        </Route>
        {/* You can add more routes here as your app grows */}
      </Routes>

  );
}

export default App;
