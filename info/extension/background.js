import apiClient from "../src/axios.js";
//Listens for messages from contentscript.js
const LAST_SYNC_KEY = 'lastAutofillSyncTime';
async function fetchDataFromBackend() {
    try {
        const response = await apiClient.get('api/candidate', {
            //headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            withCredentials: true
        });
        const data = response.data;
        console.log('Fetched latest data from backend:',data);
        saveDataToChromeStorage(data); //store the updated data.
        //chrome.storage.local.set({[LAST_SYNC_KEY]: Date.now()});
        return data;
    } catch (error) {
        console.error("Error fetching candidate data:", error);
        return null;
    }
}
function saveDataToChromeStorage(data){
    chrome.storage.local.set({autofillData: data},()=>{
        console.log("Autofill data stored in chrome storage.")

    });
}
chrome.runtime.onMessage.addListener((request,sender,sendResponse)=>{
    if(request.action === 'openPopup'){
        chrome.action.openPopup();

        //chrome.storage.local.get(auth)
        fetchDataFromBackend();
        //optionally sending a response to the contentscript.js
        sendResponse({success: true, message: 'Popup opened from content script.'});
    }

    else if(request.action === "fetching cookie"){
        apiClient.post('/api/refresh',{withCredentials: true}).then((response)=>{sendResponse({success: true, data: response.data})}).catch((error)=>{sendResponse({success: false, error: error.message})});
        return true; //Indicate response will be sent asynchronously.
        console.log('notification to fetch cookie received.')
        //on the top we made a call to candidate(as a protected endpoint where it rewuires authenticaton)
        //responjse will hold CandidateCreate object.
    }
});

async function fetchResumeFile(fileUrl){
    try{
        const response = await fetch(fileUrl);
        if (!response.ok) {
            console.log(`Failed to fetch file from URL: ${fileUrl}`, response.status);
            return false;
        }
        const blob = await response.blob();
        const filename = fileUrl.split('/').pop() || 'autofilled_file';
        const file = new File([blob], filename, { type: blob.type });

        console.log('Resume fiel fetched succesfully in background: ${filename}');
        return file;

    }
    catch(error){
        console.error('Error fetching resume file in background:',error);
        return null;
    }
}

chrome.runtime.onMessage.addListener((request,sender,sendResponse)=>{
    if(request.action === 'fetchResume'){
        fetchResumeFile(request.fileUrl).then(file =>{
            if(file){
                //we can not send file object need to convert to base64 or blob url 
                const reader = new FileReader();
                reader.onload = ()=>{
                    sendResponse({success: true, fileData: reader.result,filename: file.name})
                };
                reader.onerror = () =>{
                    sendResponse({success: false, error: 'Failed to read file'});
                };
                reader.readAsDataURL(file); //Read file as base64
            }
            else{
                sendResponse({success: false, error: 'Failed to fetch file'});
            }
        });
        return true;
    }
})
setInterval(fetchDataFromBackend, 10*60*1000);




/*chrome.action.onClicked.addListener(async(tab) => {
    chrome.action.openPopup();
});*/
console.log("background js is accessed.")
