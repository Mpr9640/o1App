const jobApplicationKeywords = ['apply','job','career','application', 'profile', 'careers', 'jobs'];
//const formKeywords = ['name', 'resume','experience']
function isjobApplicationPage(){
    const url = window.location.href.toLowerCase()
    return jobApplicationKeywords.some(keyword =>url.includes(keyword));
}
let jobApplicationDetected = false;
const checkPage = async ()=>{
    if(isjobApplicationPage()){
        if(!jobApplicationDetected){
            console.log("job application detected, showing icon.");
            showIcon();
            jobApplicationDetected = true;
        }

    }
    else{
        removeIcon();
        //removeCustomPopup();
        //customPoupVisible = false;
        jobApplicationDetected = false; //reset the flag, if page is no longer a jobpage.
    }

   
}; 

function showIcon(){
    const iconUrl = chrome.runtime.getURL('images/icon.jpeg');
    const icon = document.createElement('img');
    icon.src = iconUrl;
    icon.id = 'jobAidIcon';
    icon.style.position = 'fixed';
    icon.style.top = '10px';
    icon.style.right = '10px';
    icon.style.xindex = "1000";
    icon.style.cursor = 'pointer';
    document.body.appendChild(icon);
    //Add a click Listner to trigger the popup
    icon.addEventListener('click', ()=>{
        chrome.runtime.sendMessage({action: 'openPopup'});
    });
}
function removeIcon(){
    const icon = document.getElementById('jobAidIcon');
    if(icon){
        icon.remove();
    }
}
checkPage(); //checking the page on initial load

//Optionally checking periodically if the URl changes without a full relaod
setInterval(checkPage, 5000);



//comments
/*
//function to poll localstorage for the token.
async function getStoredAuth(){
    try{
        const {authToken, authTokenExpiry } = await new Promise((resolve,reject) =>{
            chrome.storage.local.get(['authToken', 'authTokenExpiry'], (result) =>{
                if(chrome.runtime.lastError){
                    console.error("Chrome storage error:",chrome.runtime.lastError);
                    return reject(chrome.runtime.lastError);
                }
                else{
                    resolve(result);
                }
            });
        });
        console.log("Stored values:", { authToken, authTokenExpiry});
        return {authToken, authTokenExpiry};
    }
    catch(err){
        return {authToken: null, authTokenExpiry: null}; //console.log will never run after return
    }
}

async function checkForToken(){
    const {authToken: token, authTokenExpiry: expiry} = await getStoredAuth();
    if(token && expiry && !isNaN(expiry) && Date.now() < Number(expiry)){
        try{
            const response = await chrome.runtime.sendMessage({
                action:'setAuthToken',
                token: token,
                expiry: expiry
            });
            console.log("Token Msg sent:", response);
        }
        catch(error){
            console.error("Error sending  Token Msg:",error);
        }
        console.log('Token found in chrome.storage:',token);
        return token;

    }
    else{
        console.log("Token not found in chrome storage looking in local storage");
        const pageToken = localStorage.getItem('authToken');
        console.log('Token from local', token);
        const pageExpiry = localStorage.getItem('authTokenExpiry');
        console.log('expiry from local', expiry);
        if(pageToken && pageExpiry && !isNaN(pageExpiry) && Date.now()<Number(pageExpiry)){
            try{
                const response = await chrome.runtime.sendMessage({
                    action: 'setAuthToken',
                    token: pageToken,
                    expiry:pageExpiry
                });
                console.log("Token Msg sent:");
            }
            catch(error){
                console.error("Error sending Token msg:", error);
            }
            return pageToken;
        }
        else{
            console.log('Looking for token not found in local');
            return null;
            // setTimeout(checkForToken,1000);  //retry for token after 1 sec, if not available
        }

    }
checkForToken().then((token) =>{
    if(!token){
        console.warn("Ext will work only if you login in Main web app");
    }
    else{
        console.log('Token success retrieved',token);
    }


}).catch((error) =>{
    console.error("No retrieved erro came:", error);
}); 


console.log("Content.js is accessed")

} 
 try{
                const response = await chrome.runtime.sendMessage({
                    action: 'jobApplicationDetected'
                });
                console.log("Icon Msg sent:", response);
                jobApplicationDetected = true;

            }
            catch(error){
                console.error("Error sending Icon msg:", error);
            }
                
            
            */