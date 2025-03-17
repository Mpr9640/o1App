// when the extension icon is clicked , retrieve the candidate info from your API
chrome.action.onClicked.addListner(async (tab) =>{
    try{
        const response = await axios('https://yourapi.com/api/candidate?email=candidate@example.com');
        const candidateData = await response.json();

        //Use candidate data to fill out the application form on current page
        //Example: assuming the page has an input field with id "FullName"
        const NameField = document.getElementById("FullName")
        if(NameField){
            NameField.value = candidateData.FullNam;

        }
    }
    catch(error){
        console.error("Error fetching candidate data:", error);
    }
});