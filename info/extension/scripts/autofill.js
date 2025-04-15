//const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
import apiClient from "../../src/axios.js"
//Populating the input fields
function populateFields(data){
    //Helper function to normalize the field names
    function normalizeFieldName(fieldName){
        return fieldName.toLowerCase().replace(/\s/g,'').replace(/[^a-z0-9]/gi,''); //to remove white spaces, to remove any letter other than alphabet and digit
        // /g for defining globally and /i for case sensitive.
    }
    //Loop through the data from db
    for (const dataKey in data){
        const normalizedDataKey = normalizeFieldName(dataKey);
        // Find all input elements
        const inputFields = document.querySelectorAll('input,textarea, select');
        //Loop through the input fields on the page
        for(const input of inputFields){
            const normalizedInputName = normalizeFieldName(input.name || input.id || ''); //we define fallbacks if name was nto found.
            //Check if the normalized data key matches the normalized input name
            if(normalizedDataKey.includes(normalizedInputName)){
                input.value = data[dataKey];
                break; //Stop looking for a match for this dataField.
            }
        }
    }
}
async function retrieveData(token,retryCount = 0){
    try{

        if(!token){
            throw new Error("No auth token available.")
        }
        const response = await apiClient.get('api/candidate',{headers:{'Authorization': `Bearer ${token}`,'Content-Type': 'application/json'},withCredentials: true});
        const data = response.data; //response.data contains your candidate information
        chrome.storage.local.set({'userData': data},()=>{
            console.log('User data saved to local storage:',data);
        })
        console.log(response);
        populateFields(data); //call your function to populate the form

    }
    catch(error){
        console.error("Error fetching candidate data:", error);
        if(retryCount<3){
            console.log('Retrying...');
            await new Promise(resolve => setTimeout(resolve,2000)); //wait 2 seconds
            return retrieveData(token,retryCount + 1); //Recursive call
        }
        else{
            
            if(error.response){
                //The request was made and the server responded with status code
                //that tells out of the range of 2xx
                console.error('Server responded with:', error.response.status, error.response.data);
                alert(`Server error: ${error.response.status}. Please try again`);
            }
            else if (error.request){
                // the request was made but no response was received
                console.error("No response received:", error.request);
                alert('No response from server. Please check your network connection');
            }
            else{
                //something happened in setting up the request that triggered an error
                console.error('Error:', error.message);
                alert("An unexcepted error occured. Please try again");
            }
        

        }

    }
}
export function autofillInit(token){
    console.log('Autofill init called the with token');
    retrieveData(token);
}
console.log('Autofill is accessed');

/* comments 
        //Retrieve token from chrome.storage.Local using a Promise
        /*const token = await new Promise((resolve,reject)=>{
            chrome.storage.local.get('authToken', (result) =>{
                if(chrome.runtime.lastError){
                    return reject(chrome.runtime.lastError);
                }
                resolve(result.authToken);
            });

        });*/