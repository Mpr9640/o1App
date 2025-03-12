// src/components/loginpage/loginpage.jsx
import React from 'react';
import styles from './loginpage.module.css';
import {useState} from 'react';
import { useNavigate } from 'react-router-dom';
import axios from "axios";
axios.defaults.withCredentials = true;  /*used to share credentials to cookies*/


const LoginPage = () => {
  const[isSignUp, setIsSignUp] = useState(false);
  const[email, setEmail] = useState('');
  const[password,setPassword]=useState('');
  const[emailError, setEmailError]=useState('');
  const[passwordError, setPasswordError]=useState('');
  const[confirmPassword, setConfirmPassword] = useState('');
  const[confirmPasswordError, setConfirmPasswordError]=useState('');
  const[showPassword, setShowPassword]=useState(false);
  const[remember, setRemember] = useState(false);
  const[rememberToken, setRememberToken]=useState(null);
  const[showConstraints, setShowConstraints] = useState(false);
  const navigate = useNavigate();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s]+$/;
  const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  const passwordConstraints = [
    {
      label: 'At least 8 characters',
      test: (password) => password.length >= 8,//const test=(password)=>, it is defining the function name
    },
    {
      label: 'Contains an Uppercase Letter',
      test: (password) => /[A-Z]/.test(password),
    },
    {
      label: 'Contains a number',
      test: (password) => /[0-9]/.test(password),
    },
    {
      label: 'Contains a special character',
      test: (password) => /[!@#$%^&*(),.?{}|<>]/.test(password),
    },

  ];
  const allConstraintsSatisfied = passwordConstraints.every(constraint => constraint.test(password));

  const handleFocus = () =>{
    setShowConstraints(true);
  };

  const handleBlur = () =>{
    //you might want a small delay so, the user can click on the box if needed
    setTimeout(() =>{
      setShowConstraints(false);},100);
 
  };
  
  const handleEmailChange = (e) =>{
    const value = e.target.value;
    setEmail(value);
    setEmailError(emailRegex.test(value) ? '':'Invalid email Format');
  };

  const handlePasswordChange = (e) =>{
    const value = e.target.value;
    setPassword(value);
    //setPasswordError(passwordRegex.test(value) ? '' : 'Invalid Password');
  };
  const handleConfirmPasswordChange=(e)=>{
    const value = e.target.value;
    setConfirmPassword(value);
    setConfirmPasswordError(value===password ? '' : 'Password needs to be same');

  };
  const handleForgotPassword=()=>{
    navigate('/forgotpassword')
  }
  const handleSkip=()=>{
    navigate('/home');
  }

  const handleLogin= async(e) =>{
    e.preventDefault();
    if(!email){
      setEmailError('Email is required');
      return;
    }
    if(!password){
      setPasswordError('Password is required');;
      return;
    }
    if(emailError || passwordError){
      return;
    }
    if(isSignUp){
      if(!confirmPassword.trim()){
         setConfirmPasswordError('Confirm Password is required');
         return;
      }
      if(confirmPassword!==password){
        setConfirmPasswordError('password do not match');
        return;
      }
      else{
        setConfirmPasswordError('')
      }
      try{

        //Make an API call to the register endpoint
          const response = await axios.post('http://127.0.0.1:8000/api/register', { email,password});  //post to create or send new data
          console.log('Sign up Succesfully:', response.data);
          alert("Please confirm the Email.");

          setIsSignUp(false);
          setPassword('')
          setConfirmPassword('')

      }

      catch(error){
        //Extract the error mesdsage from the response.
        const errorMessage = error?.response?.data?.detail || error.message ||  "Sign up failed. Please try again."; 
        console.error("Sign up failed:", error);
        alert(errorMessage);

      }
    }
    else{
      //sign-in flow
      try{
        const response =await axios.post('http://127.0.0.1:8000/api/login',{ email, password}, {withCredentials: true} );
        console.log("Login successful", response.data);
        if(remember && response.data.token){
          //save token to state and local storage
          setRememberToken(response.data.token);
          
        }
        //alert('LogIn Successful');
        navigate("/home");
      }
      catch(error){
        const errorMessage = error?.response?.data?.detail || "LogIn Failed";
        if(errorMessage === "User info is not confirmed Yet"){
          alert("Please confirm the email");
        }
        else{
          /*console.error("Login failed:", error);
          alert("Invalid Credentials");*/
          alert(errorMessage);
        }

      }
    }
    

  };

  return(
    <div className={styles.entryform}> 

      <div className={styles.leftpanel}>
        {isSignUp?(
          <>
          <h2>Welcome Back</h2>
          <p>Log In to access all the feautures</p>
          <div className={styles.actionbuttons}>
            <button type = "button" className={styles.togglingbutton} onClick={()=>setIsSignUp(false)}>Sign In</button>
          </div>
          </>
        ) : (
          <>
          <h2>Sign In</h2>
          <form onSubmit={handleLogin}>
            <div className={styles.entry}>
              <input type = 'text' placeholder="Email" value={email} onChange={handleEmailChange}/>
              {emailError && <p className={styles.error}>{emailError}</p>}
            </div>
            <div className= {styles.entrypasswordcontainer}>
              <input type = {showPassword?'text': 'password'} placeholder = "Password" value={password} onChange={handlePasswordChange}/>
              <button type = 'button' className={styles.showpassword} onClick={()=>setShowPassword(!showPassword)}>{showPassword ? "🙈" : "👁️"}</button>
              {passwordError && <p className={styles.error}>{passwordError}</p>}

            </div>
            <div className ={styles.rememberme}>
              <label>
                <input type = "checkbox" checked = {remember} onChange = {(e) => setRemember(e.target.checked)}/>
                Remember Me
              </label>
            </div>
            <div className={styles.forgotpassword}>
              <button type="button" onClick={handleForgotPassword}>Forgot Password</button>
            </div>
            
            <div className={styles.actionbuttons}>
              <button type="submit">Sign In</button>
              <div className={styles.skip}>
                  <button type='button' onClick={handleSkip}>Skip</button>
              </div>
            </div>


          </form>
          </>
        )}
      </div>
       {/* Right Panel */}
      <div className={styles.rightpanel}>
        {
          isSignUp? (
            <>
              <h2>Sign Up</h2>
              <form onSubmit={handleLogin}>
                <div className={styles.entry}>
                  <input type='text' placeholder='email' value={email} onChange={handleEmailChange}/>
                  {emailError && <p className={styles.error}>{emailError}</p>}
                </div>
                <div className={styles.entrypasswordcontainer} style={{position: 'relative'}}>
                  <input type={showPassword? 'text' : 'password'} placeholder='password' value={password} onFocus={handleFocus} onBlur={handleBlur} onChange={handlePasswordChange}/>
                  <button type='button' className={styles.showpassword} onClick={()=>setShowPassword(!showPassword)}>{showPassword ? "🙈" : "👁️"}</button>
                  {showConstraints &&(
                    <div className={styles.constraintspopup} style={{visibility: allConstraintsSatisfied?"hidden":"visible"}}>
                       <ul className={styles.constraintslist}>
                        {
                          passwordConstraints.map((constraints, index) => {
                            const valid = constraints.test(password);
                            return (
                              <li key={index} className = {valid? styles.valid : styles.invalid}>
                                {valid ? '✓' : '✗'} {constraints.label}
                              </li>
                            )
                          })
                        } 
                       </ul>

                    </div>
                     
                  )}
                  {passwordError && <p className={styles.error}>{passwordError}</p>}
                

                </div>

                <div className={styles.entry}>
                  <input type='password' placeholder='confirmPassword' value={confirmPassword} onChange={handleConfirmPasswordChange}/>
                  {confirmPasswordError && <p className='error'>{confirmPasswordError}</p>}
                </div>
                <div className={styles.actionbuttons}>
                  <button type='submit'>Sign Up</button>
                  <button type='button' className={styles.skip} onClick={handleSkip}>Skip</button>
                </div>


              </form>
              
              

            </>
          ) :
          (
            <>
              <h2>Register and Access all Feautures</h2>
              <p> Create an account to explore all the services</p>
              <button type='button' className={styles.togglingbutton} onClick={()=>{setIsSignUp(true)}}>Sign Up</button>
            </>
          )
        }
      
      </div>
      {/* Skip Button */}

    </div>
  );
}
export default LoginPage;
