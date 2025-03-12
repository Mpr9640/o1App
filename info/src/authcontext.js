import React, {createContext, useEffect, useState} from 'react';
import axios from 'axios';

export const AuthContext = createContext();   //intialized Using createContext() which is used for global store for managing authentiaction data(loggen-data).

export const AuthProvider = ({children}) =>{ //Makes avaialble to all nested components that consume context 
    const[user, setUser] = useState(null);    //children means the Authprovider is component that wraps aroung all the children componnets
    //Try autologin 
    useEffect(()=>{
    axios.get("http://127.0.0.1:8000/api/me",{withCredentials: true}).then(response=>{
        setUser(response.data); // if the backend returns user data, we assume the user is authenticated.
      })
      .catch(error =>{
        console.error("User not logged in",error);
        setUser(null);
      });
    }, []);

    return (
        <AuthContext.Provider value ={{user,setUser}}>  {/*making user and set user available to all the components wrapped by AuthProvider*/}
            {children}
        </AuthContext.Provider>
    );
};