import React, {createContext, useEffect, useState} from 'react';
import axios from 'axios';

export const AuthContext = createContext();   //intialized Using createContext() which is used for global store for managing authentiaction data(loggen-data).
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
export const AuthProvider = ({children}) =>{ //Makes avaialble to all nested components that consume context 
    const[user, setUser] = useState(null);    //children means the Authprovider is component that wraps aroung all the children componnets
    const[token,setToken] = useState(null);

    //On the app startUp, check the URL if it contains Oauth token(in the hash)
    useEffect(()=>{
      const hash = window.location.hash; //to retrieve the URL that follos # symbol. known as hash fradgment.
      if(hash){
        const params = new URLSearchParams(hash.substring(1)); //creating a URLSP obj to parse # frag into key-value pairs.
        //hash.substring(1) removes the # before parsing.
        const oauthToken = params.get("access_token");
        //const expiresIn = 86400; //24 hours in seconds
        const expiresIn = 3600;
        if(oauthToken){
          const expirationTime = Date.now() + Number(expiresIn)* 1000; // 1000 converts the seconds in ms.
          //Store token securely(for example, in localStorage)
          localStorage.setItem("authToken","oauthToken");
          localStorage.setItem("authTokenExpiry", expirationTime);
          setToken(oauthToken);
          //clear the URL hash so the token is not exposed further 
          window.history.replaceState({},document.title, Window.location.pathname); //Removing extra components liek #,key-valuepair,storing only based url

        }
      }
      else{
        //if no token in URL,check local storage
        const storedToken = localStorage.getItem("authToken");
        const storedExpiry = localStorage.getItem("authTokenExpiry");
        if(storedToken && storedExpiry && Date.now() < Number(storedExpiry)){
          setToken(storedToken)
        }
        else{
          //Token expired or missing, clear storage
          localStorage.removeItem('authToken');
          localStorage.removeItem('authTokenExpiry');
        }
      }
    },[]); //[] dependency array
    //If we have a token, attempt to get the user info from the backend.Try autologin 
   /*
   useEffect(()=>{
      if(token){
        axios.get(`${API_BASE_URL}/api/me`,{withCredentials: true,headers:{Authorization:`Bearer ${token}`},}).then(response=>{
          setUser(response.data); // if the backend returns user data, we assume the user is authenticated.
        })
        .catch(error =>{
          console.error("User not logged in",error);
          setUser(null);
        });
        
      }

    }, [token]); */


    
    //LogIn function: redirect the user to the OAuth Provider.
    const login = () =>{
      //Construct the Oauth Url  based on your providers requirements.
      const redirectUri = window.location.origin + "/auth/callback"; // if you are http://lhost:3/auth than it makes to go http://lhost:3
      const oauthUrl = "https//oauth.google.com/o/oauth2/v2/auth" + 
      "?client_id=159394642700-i51b4uofs4m70etm1koar1fbgen2l511.apps.googleusercontent.com" +
      "&redirect_uri" + encodeURIComponent(redirectUri) +    //encode make sures u had /,:...(spl char)
      "&response_type=token" +
      "&scope=openid%20email"; //Adjust the scope as you need. 20 reps space in URL encode
      Window.location.href = oauthUrl;


    };
    // Log out function: remove the token and optionally call your logout API endpoint
    const logout = async() =>{
      try{
        await axios.post(`${API_BASE_URL}/api/logout`,{},{headers: { Authorization: `Bearer ${token}`},withCredentials: true});
        setUser(null);
        setToken(null);
        localStorage.removeItem('authToken');
        localStorage.removeItem('authTokenExpiry');
      }
      catch(error){
        console.error("Logout error", error);
      }

    };

    return (
        <AuthContext.Provider value ={{user,token,login,logout}}>  {/*making user and set user available to all the components wrapped by AuthProvider*/}
            {children}
        </AuthContext.Provider>
    );
};