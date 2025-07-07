const jobApplicationKeywords = ['apply','job','career','application', 'profile', 'careers', 'jobs'];
//const formKeywords = ['name', 'resume','experience']
function isjobApplicationPage(){
    const url = window.location.href.toLowerCase()
    return jobApplicationKeywords.some(keyword =>url.includes(keyword));
}

// Function to get the job description text
/*function getJobDescriptionText() {
    // --- IMPORTANT: You need to replace this with your actual DOM query ---
    // Example: This might be the innerText of a specific div or section
    const jobDescriptionElement = document.querySelector('#jobDescriptionText') ||
                                  document.querySelector('.job-details-content') ||
                                  document.body; // Fallback to body text

    if (jobDescriptionElement) {
        return jobDescriptionElement.innerText;
    }
    return ''; // Return an empty string if no text is found
}*/
function getJobDescriptionText() {
  const headings = Array.from(document.querySelectorAll('p,h1, h2, h3, h4, h5, h6, strong, b')).filter(h =>
    /rolerequirements|overview | abouttherole|duties|requirements|qualifications|description|needs|skills|responsibilities/i.test(h.textContent.toString().replace(/\s/g,'').toLowerCase())
  );

  const jobText = headings.map(h => {
    const siblingText = h.nextElementSibling ? h.nextElementSibling.innerText : '';
    return h.textContent + ' ' + siblingText;
  }).join(' ');

  return jobText //|| document.body.innerText; // fallback
}

const jobDescriptionText = getJobDescriptionText();


let jobApplicationDetected = false;
const checkPage = async ()=>{
    if(isjobApplicationPage()){
      if(!jobApplicationDetected){
        console.log("job application detected, showing icon.");
        showIcon();
        jobApplicationDetected = true;
      }
      if(jobDescriptionText){
        console.log('Job description found sending a message to background');
        chrome.runtime.sendMessage({action:"jdText",text:jobDescriptionText});
        console.log('job description text',jobDescriptionText);
      }


    }

    else{
        removeIcon();
        //removeCustomPopup();
        //customPoupVisible = false;
        jobApplicationDetected = false; //reset the flag, if page is no longer a jobpage.
    }

   
}; 
function showIcon() {
    const iconUrl = chrome.runtime.getURL('images/icon.jpeg');
    const icon   = document.createElement('img');
    icon.src     = iconUrl;
    icon.id      = 'jobAidIcon';
  
    // initial CSS
    Object.assign(icon.style, {
      position:   'fixed',
      left:       '20px',
      top:        '20px',
      width:      '48px',
      height:     '48px',
      zIndex:     '10000',
      cursor:     'pointer',
      userSelect: 'none',
    });
  
    let isDragging = false;
    let moved      = false;
    let offsetX    = 0;
    let offsetY    = 0;
  
    // Start drag on pointerdown
    icon.addEventListener('pointerdown', e => {
      isDragging = true;
      moved      = false;
      offsetX    = e.clientX - icon.offsetLeft;
      offsetY    = e.clientY - icon.offsetTop;
      icon.setPointerCapture(e.pointerId);
      icon.style.cursor = 'grabbing';
      // prevent text‑selection / image drag
      e.preventDefault();
    });
  
    // Move on pointermove
    icon.addEventListener('pointermove', e => {
      if (!isDragging) return;
      moved = true;
      //compute raw positions
      x= e.clientX - offsetX;
      y= e.clientY - offsetY;
    // clamp to [0, viewport-iconSize]
      const maxX=window.innerWidth - icon.offsetWidth;
      const maxY = window.innerHeight-icon.offsetHeight;

      x=Math.max(0,Math.min(x,maxX));
      y=Math.max(0,Math.min(y,maxY));

      icon.style.left = x + 'px';
      icon.style.top = y + 'px';

    });
  
    // End drag on pointerup (auto‑drops)
    icon.addEventListener('pointerup', e => {
      if (!isDragging) return;
      isDragging = false;
      icon.releasePointerCapture(e.pointerId);
      icon.style.cursor = 'pointer';
    });
  
    // Click handler: only fire if no drag occurred
    icon.addEventListener('click', e => {
      if (moved) {
        // suppress any click after a drag
        e.stopImmediatePropagation();
        return;
      }
      chrome.runtime.sendMessage({ action: 'openPopup' });
    });
  
    document.body.appendChild(icon);
  }
  
function removeIcon(){
    const icon = document.getElementById('jobAidIcon');
    if(icon){
        icon.remove();
    }
 
    //if(existing) existing.remove();
}
checkPage();
//document.addEventListener(DOMContentLoaded,checkPage); //checking the page on initial load

//Optionally checking periodically if the URl changes without a full relaod
//setInterval(checkPage, 5000);

function displayMatchingPerecentage(percentage,matchedwords){
  let displayElement = document.getElementById('skillMatchPercentageDisplay');
  if(!displayElement){
    displayElement = document.createElement('div');
    displayElement.id = 'skillMatchPercentageDisplay';
    //Basic styling for visibility - customize needed.
    displayElement.style.position = 'fixed';
    displayElement.style.top = '10px';
    displayElement.style.left = '10px';
    displayElement.style.backgroundColor = 'rgba(0,0,0,0.7)';
    displayElement.style.color = 'white';
    displayElement.style.padding = '8px';
    displayElement.style.birderRadius = '5px';
    displayElement.style.zIndex = '10000';
    displayElement.style.cursor = 'pointer';
    document.body.appendChild(displayElement);
  }
  displayElement.textContent = `Skill Match: ${percentage.toFixed(2)}%`;
  let skillMatch = true;
  displayElement.onclick = function(){

    if(skillMatch){
      displayElement.textContent = `matchedwords: ${matchedWords.join(',')}`;
      skillMatch = false;
    }
    else{
      displayElement.textContent = `Skill Match: ${percentage.toFixed(2)}%`;
      skillMatch = true;
    }
      
  }
  console.log(`Displayed skill match perecentage: ${percentage.toFixed(2)}%`);
}
let matchedWords = [];
let percentage = 0;
chrome.runtime.onMessage.addListener((request,sender,sendResponse)=>{
  console.log('received a message for display');
  if(request.action === 'displayPercentage' && typeof request.percentage === 'number'){
    matchedWords = request.matchedWords;
    percentage = request.percentage;
    displayMatchingPerecentage(percentage,matchedWords);
    sendResponse({status: 'success'}); //Acknowledge receipt
  }
})

