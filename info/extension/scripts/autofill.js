// autofill.js
//import apiClient from "../../src/axios.js"; // This import is commented out, so apiClient isn't used here.

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'HTTP://LOCALHOST:8000';
const style = document.createElement('style');
style.textContent = `.autofill-highlight{
   outline:2px solid gold !important;
   transition: outline 0.3s ease-out;
}`;
document.head.appendChild(style);

let hasAutofilled = false; // Flag to track if autofill has run
let autofillData = null; // Store fetched data globally, will be populated by populateFields
//const LAST_SYNC_KEY = 'lastAutofillSyncTime'

function normalizeFieldName(fieldName) {
    return (fieldName || '').toString().toLowerCase().replace(/\s/g, '').replace(/[^a-z0-9]/gi, '').trim();
}
function normalizeFieldNameWithSpace(fieldName){
    return (fieldName || '').toString().toLowerCase().replace(/[^a-z0-9\s]/gi,'').replace(/([a-z]([A-Z]))/g,'$1 $2').trim(); //.replace(/(\d+)/g,' $1')
}



function inputFieldSelection(field){
    let humanReadableName ='';
    //label id
    if(field.id){
        humanReadableName = field.id;
        const labelElement = document.querySelector(`label[for="${field.id}"]`);
        if (labelElement){
            humanReadableName +=labelElement.textContent.trim();
            console.log('Input selected at step 1 by id');
        }
        
       
    }
      // 3. SPECIAL RULE: Fieldset legend or direct label for radio/checkbox groups
    const parentFieldset = field.closest('fieldset');
    if (parentFieldset) {
        // Option A: Look for <legend> (semantically ideal for fieldsets)
        const legend = parentFieldset.querySelector('legend');
        if (legend && legend.textContent.trim()) {
            humanReadableName = legend.textContent.trim();
            console.log('Phase 0: Found via fieldset legend:', humanReadableName);
            // Apply cleanup here for early exit
            if (field.value && humanReadableName.includes(field.value)) humanReadableName = humanReadableName.replace(field.value, '').trim();
            if (field.placeholder && humanReadableName.includes(field.placeholder)) humanReadableName = humanReadableName.replace(field.placeholder, '').trim();
            return normalizeFieldNameWithSpace(humanReadableName);
        }

        // Option B: Look for a direct <label> child of the fieldset (your HTML)
        const fieldsetLabel = parentFieldset.querySelector(':scope > label'); // :scope ensures direct child
        if (fieldsetLabel && fieldsetLabel.textContent.trim()) {
            humanReadableName = fieldsetLabel.textContent.trim();
            console.log('Phase 0: Found via direct fieldset label:', humanReadableName);
            // Apply cleanup here for early exit
            if (field.value && humanReadableName.includes(field.value)) humanReadableName = humanReadableName.replace(field.value, '').trim();
            if (field.placeholder && humanReadableName.includes(field.placeholder)) humanReadableName = humanReadableName.replace(field.placeholder, '').trim();
            return normalizeFieldNameWithSpace(humanReadableName);
        }
    }


     // 2. Traverse up the DOM tree to find a <label> as a parent or previous sibling.
    // This handles implicit labels (input inside label) or labels immediately preceding the field's container.
    let currentElement = field;
    while (!humanReadableName && currentElement && currentElement !== document.body) {
        // Check if the current element itself is a label (implicit association)
        if (currentElement.tagName.toUpperCase() === 'LABEL') {
            humanReadableName = currentElement.textContent.trim();
            if (humanReadableName) {
                console.log('Found name via implicit label (parent is label):', humanReadableName);
                break; // Found a label, exit this loop
            }
        }

        // Check if the current element's parent is a label
        if (currentElement.parentNode && currentElement.parentNode.tagName.toUpperCase() === 'LABEL') {
            humanReadableName = currentElement.parentNode.textContent.trim();
            if (humanReadableName) {
                console.log('Found name via parent label:', humanReadableName);
                break; // Found a label, exit this loop
            }
        }

        // Check if the previous sibling of the current element is a label
        let prevSibling = currentElement.previousElementSibling ;
        while(!humanReadableName && prevSibling){
            if (prevSibling.tagName.toUpperCase() === 'LABEL') {
                humanReadableName = prevSibling.textContent.trim();
                if (humanReadableName) {
                    console.log('Found name via previous sibling label:', humanReadableName);
                    break; // Found a label, exit this loop
                }
            }
            prevSibling = prevSibling.previousElementSibling;
        }
        
        currentElement = currentElement.parentNode; // Move up to the next parent
    }

    // If a label was found in Phase 1, clean it up and return.
    if (humanReadableName) {
        // Remove input placeholder or value if they exist inside the extracted text
        if (field.value && humanReadableName.includes(field.value)) {
            humanReadableName = humanReadableName.replace(field.value, '').trim();
        }
        if (field.placeholder && humanReadableName.includes(field.placeholder)) {
            humanReadableName = humanReadableName.replace(field.placeholder, '').trim();
        }
        humanReadableName = normalizeFieldNameWithSpace(humanReadableName);
        return humanReadableName;
    }

    // --- Phase 2: Fallback to generic container elements (DIV, SECTION, SPAN) ---
    // This phase only runs if no meaningful label was found in Phase 1.
    currentElement = field; // Reset currentElement to the original field for the second pass
    while (!humanReadableName && currentElement && currentElement !== document.body) {
        const parent = currentElement.parentNode;

        // Check parent's text content if it's a DIV, SECTION, or SPAN
        if (parent && ['DIV', 'SECTION', 'SPAN'].includes(parent.tagName.toUpperCase())) {
            let potentialName = parent.textContent.trim();
            // Remove input placeholder or value if they exist inside text
            if (field.value && potentialName.includes(field.value)) {
                potentialName = potentialName.replace(field.value, '').trim();
            }
            if (field.placeholder && potentialName.includes(field.placeholder)) {
                potentialName = potentialName.replace(field.placeholder, '').trim();
            }
            if (potentialName) { // Only assign if a meaningful name was found
                humanReadableName = potentialName;
                console.log('Found name via parent (DIV/SECTION/SPAN):', humanReadableName);
                break; // Found a name, exit this loop
            }
        }

        // Check previous sibling's text content if it's a DIV, SECTION, or SPAn
        let prevSibling = currentElement.previousElementSibling;
        while(!humanReadableName && prevSibling){
            if (['DIV', 'SECTION', 'SPAN'].includes(prevSibling.tagName.toUpperCase())) {
                let potentialName = prevSibling.textContent.trim();
                // Remove input placeholder or value if they exist inside text
                if (field.value && potentialName.includes(field.value)) {
                    potentialName = potentialName.replace(field.value, '').trim();
                }
                if (field.placeholder && potentialName.includes(field.placeholder)) {
                    potentialName = potentialName.replace(field.placeholder, '').trim();
                }
                if (potentialName) { // Only assign if a meaningful name was found
                    humanReadableName = potentialName;
                    console.log('Found name via previous sibling (DIV/SECTION/SPAN):', humanReadableName);
                    break; // Found a name, exit this loop
                }
            }
            prevSibling = prevSibling.previousElementSibling;

        }


        currentElement = currentElement.parentNode; // Move up to the next parent
    }


    
    // Aria attributes(accessbility)
    if(!humanReadableName && field.hasAttribute('aria-labelledby')){
        const labelledById = field.getAttribute('aria-labelledby');
        const labelledByIdElement = document.getElementById(labelledById);
        if(labelledByIdElement){
            humanReadableName = labelledByIdElement.textContent.trim();
        }
        console.log('3rd case');
    }

    if(!humanReadableName && field.hasAttribute('aria-label')){
        humanReadableName = field.getAttribute('aria-label').trim();
        console.log('4th case');
    }
    
    //Fallback

    if(!humanReadableName && field.hasAttribute('placeholder')){
        humanReadableName = field.placeholder.trim();
        console.log('5th case')
    }

    if(!humanReadableName && field.hasAttribute('title')){
        humanReadableName = field.title.trim();
        console.log('6th case');
    }
    
    //Name attribute
    if(!humanReadableName && field.name){
        humanReadableName = normalizeFieldNameWithSpace(field.name);
        console.log('7th case');
    }
    humanReadableName = normalizeFieldNameWithSpace(humanReadableName);
    return humanReadableName;

} 


function isParseResumeInut(input) {

    const normalizedInput = inputFieldSelection(input);
    // checking if label or surrounding context hints it's a parsing resume upload
    const parseHints = ['autofill', 'parse', 'auto', 'smart', 'generate'];

    const wrapper = input.closest('form,section,div,fieldset');
    const contextText = (wrapper?.textContent || '') + '' + normalizedInput;

    return parseHints.some(hint => contextText.toLowerCase().includes(hint));
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (error) {
        console.error("Error formatting date:", error, dateString);
        return "";
    }
}

//Function fot field set radio/checkbox.
function findAssociatedLabel(input) {
    const container = input.closest('div, span, label');

    if (!container) return null;

    // 1. Check if label exists inside the container
    let label = container.querySelector('label');
    if (label) return label.textContent.trim();

    // 2. Check siblings (forward or backward)
    const siblingLabels = [...container.parentElement?.children || []]
        .filter(el => el.tagName?.toLowerCase() === 'label');

    if (siblingLabels.length > 0) {
        return siblingLabels[0].textContent.trim(); // pick first if multiple
    }

    return null;
}


async function queueFillInputs(input,val){
        if (val !== undefined) {
            await fillInput(input, val);
            await delay(100);
        }
}

// ---
// Core Input Filling Logic
// ---
async function fillInput(el, value) {
    const tag = el.tagName.toUpperCase();
    const type = el.type?.toLowerCase();

    // Skip if element is disabled or read-only
    if (el.disabled || el.readOnly) {
        console.warn(`Element is disabled or read-only, skipping:`, el);
        return;
    }

    //let normalizedValue = normalizeFieldNameWithSpace(String(value));
    let normalizedValue = value;

    if (normalizedValue == true) {
        normalizedValue = 'yes';
    } else if (normalizedValue == false) {
        normalizedValue = 'no';
    }
    
    console.log(' starting fillInput: Tag name', tag, 'Type', type, 'Value', normalizedValue);
    console.log(`normalizedValue${normalizedValue}`);

    if (tag === 'SELECT') {
        // Handle complex dropdowns/comboboxes (e.g., Material-UI, React-Select)
        normalizedValue = normalizeFieldNameWithSpace(normalizedValue);
        if (el.getAttribute('role') === 'combobox' ||
            el.classList.contains('autocomplete') ||
            el.closest('.dropdown-menu,.MuiAutocomplete-root') ||
            (el.placeholder && el.placeholder.toLowerCase().includes('search')) ||
            (el.placeholder && el.placeholder.toLowerCase().includes('select'))) {
            console.log('fillInput: Detected complex dropdown/combobox.');
            await trySearchingInDropdown(el, normalizedValue);
        } else {
            // Handle standard <select> elements
            console.log('fillInput: Detected standard <select> element.');
            await delay(100);
            let optionSelected = false;
            for (const opt of el.options) {
                const normalizedOptionValue = normalizeFieldName(opt.value);
                const normalizedOptionText = normalizeFieldName(opt.textContent);

                if (normalizedOptionValue == normalizedValue ||normalizedOptionText == normalizedValue){
                    el.focus();//focussing before making an attempt to click/select
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.click(); // May open native dropdown, but not strictly necessary for programmatic selection
                    opt.selected = true;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log('Selected standard select option:', opt.textContent);
                    optionSelected = true;
                    break;
                }
                else if(normalizedOptionValue.includes(normalizedValue) || normalizedOptionText.includes(normalizedValue)){
                    el.focus();//focussing before making an attempt to click/select
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.click(); // May open native dropdown, but not strictly necessary for programmatic selection
                    opt.selected = true;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log('Selected standard select option:', opt.textContent);
                    optionSelected = true;
                    break;

                }
            } 
            if(!optionSelected){
                console.log(`No matching option found for standard <select> with value: ${value}`);

            }
            el.blur();
            el.dispatchEvent(new Event('blur',{bubbles: true}));

        }
    } else if (type === 'checkbox' || type === 'radio') {
        
        normalizedValue = normalizeFieldNameWithSpace(normalizedValue);
        console.log('normalized value in checkbox',normalizedValue);
        console.log('fillInput: Detected checkbox or radio input.');
        const parentFieldset = el.closest('fieldset');
        console.log('parentFieldset',parentFieldset);
        if(parentFieldset){
            const label = parentFieldset.querySelector('legend,h1,h2,h3,label');
            const labelText = label?label.textContent.trim():" ";
            console.log('labelText',labelText);
            const normalizedLabelText = normalizeFieldNameWithSpace(labelText);
            console.log('normlabelText',normalizedLabelText);
            const groupInputs = [...document.querySelectorAll(`input[type="radio"][name="${el.name}"]`)];
            console.log('groupInputs are',groupInputs);
            const matchedInput = groupInputs.find(radio => {
                const labelText = findAssociatedLabel(radio)?.toLowerCase();
                return labelText === normalizedValue || labelText?.includes(normalizedValue);
            });

            console.log('first check',matchedInput);

            if (!matchedInput) {
                matchedInput = groupInputs.find(radio => {
                   const labelText = findAssociatedLabel(radio)?.toLowerCase();
                   return labelText === normalizedValue || labelText?.includes(normalizedValue);
                });
            }
            if(matchedInput){
                matchedInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await delay(50);
                //const input = groupLabel;
                if (matchedInput && typeof matchedInput.click === 'function' && !matchedInput.checked) { // Only click if not already checked
                    matchedInput.click();
                    matchedInput.dispatchEvent(new Event('change', { bubbles: true }));
                } else if (!el.checked) { // Fallback if click is not available/needed
                    matchedInput.checked = true;
                    matchedInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
                matchedInput.blur(); //Simulating blur
                matchedInput.dispatchEvent(new Event('blur',{bubbles: true}));
                return;

            }

        }

        let dataKey;
        const wrapper = el.closest('div,section,fieldset');
        console.log('wrapper',wrapper);
        if(wrapper) {
            const groupLabel = wrapper.querySelector('legend,h1,h2,h3,label');
            const groupText = groupLabel ? normalizeFieldName(groupLabel.textContent) : "";
            console.log('groupLabel',groupLabel);
            console.log('groupText',groupText);
            if(groupText == normalizedValue){
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await delay(50);
                //const input = groupLabel;
                if (el && typeof el.click === 'function' && !el.checked) { // Only click if not already checked
                    el.click();
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                } else if (!el.checked) { // Fallback if click is not available/needed
                    el.checked = true;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
                console.log(`New Selected checkbox/radio in group "${groupText}"`);
                el.blur(); //Simulating blur
                el.dispatchEvent(new Event('blur',{bubbles: true}));
                return;

            }
            else if(groupText.includes(normalizedValue)){
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await delay(50);
                //const input = groupLabel;
                if (el && typeof el.click === 'function' && !el.checked) { // Only click if not already checked
                    el.click();
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                } else if (!el.checked) { // Fallback if click is not available/needed
                    el.checked = true;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
                console.log(`New Selected checkbox/radio in group "${groupText}"`);
                el.blur(); //Simulating blur
                el.dispatchEvent(new Event('blur',{bubbles: true}));
                return;

            }

            /*// This correctly accesses the global `autofillData`
            else if (autofillData && Object.keys(autofillData).length > 0) {
                // Try to find a data key matching the group label
                dataKey = Object.keys(autofillData).find(key => groupText.includes(normalizeFieldName(key)));
            }
            console.log('datakey',dataKey);
            console.log('autofillData',autofillData);
            console.log('autofill datakey',autofillData[dataKey]);


            // Changed condition to directly use dataKey for finding the value
            if (dataKey && autofillData && autofillData[dataKey] !== undefined) { // Check for undefined to allow empty strings/false
                let data = normalizeFieldName(autofillData[dataKey]);
                if (data === 'true') {
                    data = 'yes';
                } else if (data === 'false') {
                    data = 'no';
                }

                const groupInputs = wrapper.querySelectorAll(`input[type="${type}"]`);
                let optionSelected = false;
                for (const input of groupInputs) {
                    const val = normalizeFieldName(input.value); // Normalize input's own value
                    // Check if normalized input value is included in the normalized data from autofillData
                    console.log('checkbox',val);

                    if (val.includes(data)) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        await delay(50);
                        if (input && typeof input.click === 'function' && !input.checked) { // Only click if not already checked
                            input.click();
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                        } else if (!input.checked) { // Fallback if click is not available/needed
                            input.checked = true;
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                        console.log(`Selected checkbox/radio in group "${groupText}": ${input.value}`);
                        optionSelected = true;
                        break;
                    }
                }
                if(optionSelected){
                    el.blur();
                    el.dispatchEvent(new Event('blur',{bubbles: true}));
                    return;
                }
                console.log(`No matching option found in group "${groupText}" for value: ${value}`);
            }*/
        } 
        // Fallback for standalone checkboxes/radios or if group data isn't found
        // Ensure this fallback still works if no group/dataKey was found
        const targetCheckedState = (normalizedValue === 'yes');
        if (el.checked !== targetCheckedState) { // Only change if current state doesn't match target
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              await delay(50);
            if (el && typeof el.click === 'function') {
                el.click(); // Click to toggle state
            } else {
                el.checked = targetCheckedState;
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
            console.log(`Selected standalone checkbox/radio: ${el.value}, set to: ${targetCheckedState}`);
        }
        el.blur();
        el.dispatchEvent(new Event('blur',{bubbles: true}));

    }else if (el.type !== 'file') { // Prevent setting value on file inputs directly
        console.log('fillInput: Detected standard text/number/date input.');
        el.focus();
        el.click(); // Click to focus or activate input
        await delay(50);
        if (normalizedValue === 'yes' || normalizedValue === 'no') {
            value = normalizedValue; // Use normalized "yes"/"no" for text inputs if applicable
        }

        // If it's a text input that might be part of an autocomplete/combobox
        if (el.getAttribute('role') === 'combobox' ||
            el.classList.contains('autocomplete') ||
            el.closest('.dropdown-menu,.MuiAutocomplete-root') ||
            (el.placeholder && el.placeholder.toLowerCase().includes('search')) ||
            (el.placeholder && el.placeholder.toLowerCase().includes('select'))) {
            console.log('fillInput: Detected text input acting as a complex dropdown/combobox.');
            await trySearchingInDropdown(el, normalizedValue);
            return;
        } else {
            // Standard text-like input
            //el.value = normalizedValue;
            //el.dispatchEvent(new Event('input', { bubbles: true }));
            //el.dispatchEvent(new Event('change', { bubbles: true })); // Important for frameworks
            //await delay(10);
            for (let i =0; i< value.length; i++){
                const char = value[i];
                el.value +=char;

            // Dispatch keyboard events for more realistic simulation
            // keydown and keypress can trigger dropdowns to appear/filter
                el.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true, cancelable: true }));
                el.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true, cancelable: true }));
                el.dispatchEvent(new Event('input', { bubbles: true })); // Regular input event
                el.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true, cancelable: true }));

                await delay(10);
            }
            el.dispatchEvent(new Event('change',{bubbles: true}));

        }
        el.blur();
        el.dispatchEvent(new Event('blur', {bubbles: true}));
    }
}

// ---
// Dropdown/Autocomplete Search Logic

async function trySearchingInDropdown(inputElement, value) {
    try {
        console.log('trySearchingInDropdown: Starting process for searchable dropdown:', inputElement);
       // 1. Ensure the input is clickable and focused
        inputElement.focus();
        inputElement.click();
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay after click
        
        inputElement.dispatchEvent(new Event('focus', { bubbles: true }));
        console.log('trySearchingInDropdown: Input element clicked and focused.');

        // 2. Clear existing value by simulating backspace or setting empty string
        inputElement.value = '';
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true })); // Trigger change after clearing
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay after clearing
        console.log('trySearchingInDropdown: Input element cleared.');

        // 3. Simulate typing character by character with keyboard events
        let optionFound = false;
        let normalizedValue = normalizeFieldName(value);
        for (let i = 0; i < value.length; i++) {
            const char = value[i];
            inputElement.value += char;
            // Dispatch keyboard events for more realistic simulation
            // keydown and keypress can trigger dropdowns to appear/filter
            inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true, cancelable: true }));
            inputElement.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true, cancelable: true }));
            inputElement.dispatchEvent(new Event('input', { bubbles: true })); // Regular input event
            inputElement.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true, cancelable: true }));
            await delay(100); // Delay between key presses for human-like typing
            // 4. Trigger a final 'change' event after typing to ensure frameworks pick it up
            inputElement.dispatchEvent(new Event('change', { bubbles: true }))

        }
        await delay(300); // Give time for UI to react to full input
        console.log(`trySearchingInDropdown: Finished simulating typing "${value}"`);
        const maxTries = 1; // Increased max tries for slower loading dropdowns
        const retryDelay = 100; // Shorter initial wait, then consistent
        // 5. Wait for dropdown options to appear and select the matching one
        for (let attempt = 0; attempt < maxTries; attempt++) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));

            // Broader set of selectors for common dropdown/autocomplete option patterns
            const options = document.querySelectorAll(
                '[role="option"]:not([aria-disabled="true"]):not(.Mui-disabled), ' + // Generic ARIA role, excluding disabled
                '.dropdown-option:not([aria-disabled="true"]), ' +
                'li.MuiAutocomplete-option:not(.Mui-disabled), ' + // Material-UI
                '.ant-select-item-option:not(.ant-select-item-option-disabled), ' + // Ant Design
                'div[data-value][role="option"], ' + // Another common pattern
                'ul > li:not([aria-disabled="true"]):not([aria-hidden="true"])' // General list items, exclude hidden/disabled
            );
            console.log(`trySearchingInDropdown: Dropdown attempt ${attempt + 1}: found ${options.length} potential options.`);
            let selectedOpt = null;

            // --- Step 1: Look for exact match first by normalized textContent or data-value ---
            selectedOpt = Array.from(options).find(opt => {
                if (opt.offsetParent === null) return false; // Skip if visually hidden
                const normalizedOptionText = normalizeFieldName(opt.textContent || opt.innerText || '').trim();
                const normalizedOptionValue = normalizeFieldName(opt.getAttribute('data-value') || opt.value || '').trim();
                return normalizedOptionText === normalizedValue || normalizedOptionValue === normalizedValue;
            });

            // --- Step 2: If no exact match, look for an "includes" match ---
            if (!selectedOpt) {
                selectedOpt = Array.from(options).find(opt => {
                    if (opt.offsetParent === null) return false; // Skip if visually hidden
                    const normalizedOptionText = normalizeFieldName(opt.textContent || opt.innerText || '').trim();
                    const normalizedOptionValue = normalizeFieldName(opt.getAttribute('data-value') || opt.value || '').trim();
                    return normalizedOptionText.includes(normalizedValue) || normalizedOptionValue.includes(normalizedValue);
                });
            }

            if(selectedOpt) {
                selectedOpt.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await new Promise(resolve => setTimeout(resolve, 100)); // Small delay before clicking
                selectedOpt.click();
                await new Promise(resolve => setTimeout(resolve,100));
                selectedOpt.dispatchEvent(new MouseEvent('mousedown',{bubbles: true,cancelable: true}));
                await new Promise(resolve => setTimeout(resolve,100));
                selectedOpt.dispatchEvent(new MouseEvent('mouseup',{bubbles: true,cancelable: true}));
                selectedOpt.dispatchEvent(new Event('change',{bubbles: true}));

                //Dispatching events on the original input element
                //crucial for react/angular/vue to recognize the change
                //inputElement.value = selectedOpt.textContent.trim(); //Updating the input's displayed value
                //inputElement.dispatchEvent(new Event('input',{bubbles: true}));
                //await new Promise(resolve => setTimeout(resolve,500));
                // Dispatch change event on the original input field after option selection
                //inputElement.dispatchEvent(new Event('change', { bubbles: true }));
                //await new Promise(resolve => setTimeout(resolve,1000)); //finally short delay.
                // If the dropdown is still open after selection , try to blur the input.
                //To force it to close and trigger final validation.
                if(document.activeElement == inputElement || inputElement.contains(document.activeElement)){
                inputElement.blur();
                inputElement.dispatchEvent(new Event('blur',{bubbles: true}));
                await new Promise(resolve => setTimeout(resolve,100));
                }
                console.log('trySearchingInDropdown: Selected matching dropdown option.');
                optionFound = true;
                break;
            }
        }

        if(!optionFound){
            console.log('trySearchingInDropdown: No matching dropdown option found after typing. Trying keyboard fallback.');
            inputElement.value = '';

            /*// Fallback: Simulate ArrowDown and Enter to select the first highlighted option
            inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay
            inputElement.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, 1000)); // Give time for selection to highlight

            inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            inputElement.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true })); // Trigger change after Enter
            inputElement.blur();
            inputElement.dispatchEvent(new Event('blur',{bubbles: true}));
            console.log('trySearchingInDropdown: Attempted keyboard fallback (ArrowDown + Enter).');*/
        }
    } 
    catch (error) {
        console.error('trySearchingInDropdown: Error while trying to select from searchable dropdown:', error);
    }
}

async function buttonselecting(input,val){
    const uploadButton = input.closest('form')?.querySelector('button, .btn, .upload-resume');
    if(uploadButton && /parse|resume|upload|attach|from/i.test(uploadButton.textContent)){
        simulateMouseMove(input);
        uploadButton.click();
        await delay(100);
    }
    await handleFileInput(input,val);
}
async function handleFileInput(input, fileUrl) {
    try {
        console.log('file url:', fileUrl);
        const src = fileUrl.startsWith('http') ? fileUrl : `${API_BASE_URL}${fileUrl}`;
        const filename = src.split('/').pop() || 'resume.pdf';
        const link = document.createElement('a');
        link.href = src;
        link.textContent = filename;
        link.target = '_blank';
        link.style.display = 'inline-block';
        link.style.marginLeft = '8px';
        link.style.color = '#06c';
        link.style.textDecoration = 'underline';
        input.parentNode.insertBefore(link, input.nextSibling);

        const success = await simulateFileSelectionFromBackground(input, src);
        if (success) {
            console.log("Resume file set using direct file simulation.");
            return true; // Indicate success
        }

        console.warn("Direct file simulation failed. Automatic resume upload unsuccessful.");
        return false; // Indicate failure

    } catch (err) {
        console.error('Failed to handle file input:', err);
        return false; // Indicate failure
    }
}
async function simulateFileSelectionFromBackground(inputElement, fileUrl) {
    try {
        const { fileData, filename } = await fetchResumeFromBackground(fileUrl);
        const resBlob = dataURLtoBlob(fileData);
        const file = new File([resBlob], filename, { type: resBlob.type });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        inputElement.files = dataTransfer.files;
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));

        console.log(`Resume file set successfully from background: ${filename}`);
        return true; // Indicate success
    } catch (error) {
        console.error('Failed to simulate file selection via background:', error);
        return false; // Indicate failure
    }
}
// ---
// File Handling and Other Utilities
async function fetchResumeFromBackground(fileUrl) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'fetchResume', fileUrl: fileUrl }, (response) => {
            if (response && response.success) {
                resolve(response);
            } else {
                reject(response.error || 'Unknown error');
            }
        });
    });
}

function dataURLtoBlob(dataurl) {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : '';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}



const sectionKeywords = [
    { keywords: [/residence/, /residential/, /home/, /permanent/,/location/,/living/], type: 'address', prefix: 'residence' },
    { keywords: [/school/, /education/, /university/,/college/], type: 'address', prefix: 'school' },
    { keywords: [/job/, /employment/, /work/, /company/, /employe/], type: 'address', prefix: 'job' },
];

function getSectionPrefix(inputElement) {
    console.log('Section prefix function started.')
    let current = inputElement;
    while (current && current !== document.body) {
        const heading = current.closest('fieldset,section,div');
        if (heading) {
            const title = heading.querySelector('legend,h1,h2,h3,label');
            if (title) {
                const text = title.textContent.toLowerCase();
                for (const section of sectionKeywords) {
                    if (section.keywords.some(k => k.test(text))) {
                        console.log('section prefix function:', section.prefix);
                        return section.prefix;
                    }
                }
            }
        }
        current = current.parentElement;
    }
    console.log('no section prefix.')
    return 'residence'; // Default prefix
}

async function fillAddressFields(input, data, prefix) {
    console.log('FillAddress fields started.')
    const normalizedInputName = inputFieldSelection(input);
    console.log('fill adress function N.IN:', normalizedInputName);
    const addressFields = {
        residence: {
            address: 'residenceaddress',
            city: 'residencecity',
            state: 'residencestate',
            zip_code: 'residencezipcode',
            country: 'residencecountry',
        },
        school: {
            Name: 'schoolname',
            address: 'schooladdress',
            city: 'schoolcity',
            state: 'schoolstate',
            zip_code: 'schoolzipcode',
            country: 'schoolcountry',
            start_date: 'schoolstartdate',
            end_date: 'schoolenddate',
            currently_studying: 'currentlystudying',
        },
        job: {
            address: 'jobaddress',
            city: 'jobcity',
            state: 'jobstate',
            zip_code: 'jobzipcode',
            country: 'jobcountry',
            start_date: 'jobstartdate',
            end_date: 'jobenddate',
            currently_working: 'currentlyworking',
            duties: 'jobduties',
            company_name: 'companyname',
            job_name: 'jobname',
        },
    };
    const currentAddressFields = addressFields[prefix];
    console.log('Fill address field continues.');
    if (!currentAddressFields) return;

    const mappings = [
        { keywords: [/address/, /street/], dataKey: currentAddressFields.address },
        { keywords: [/city/, /town/], dataKey: currentAddressFields.city },
        { keywords: [/state/, /province/,/location/], dataKey: currentAddressFields.state },
        { keywords: [/zip/, /postal/], dataKey: currentAddressFields.zip_code },
        { keywords: [/country/, /origin/, /region/], dataKey: currentAddressFields.country },
        { keywords: [/start.*date/], dataKey: currentAddressFields.start_date, type: 'date' },
        { keywords: [/end.*date/], dataKey: currentAddressFields.end_date, type: 'date' },
        { keywords: [/name/], dataKey: currentAddressFields.Name },
        { keywords: [/(current|present)/], dataKey: currentAddressFields.currently_studying, type: 'checkbox' },
        { keywords: [/(current|present)/], dataKey: currentAddressFields.currently_working, type: 'checkbox' },
        { keywords: [/company/,/employe/], dataKey: currentAddressFields.company_name },
        { keywords: [/(job|role|name|title)/], dataKey: currentAddressFields.job_name },
        { keywords: [/(duties|responsibilities|description)/], dataKey: currentAddressFields.duties },
    ];

    for (const map of mappings) {
        if (map.keywords.some(keyword => keyword.test(normalizedInputName)) && data?.[map.dataKey]) {
            console.log('FADDressF keyword matched', map.type, map.dataKey)
            if (map.type === 'date') {
                //fillInput(input, formatDate(data[map.dataKey])); // Use fillInput for date types as well
                await queueFillInputs(input,formatDate(data[map.dataKey]));
            } else if (map.type === 'checkbox' && input.type.toLowerCase() === 'checkbox') {
                //fillInput(input, data[map.dataKey]); // Use fillInput for checkboxes
                await queueFillInputs(input,data[map.dataKey]);
            } else if (input.tagName.toUpperCase() === 'SELECT' || input.getAttribute('role') === 'combobox' || input.classList.contains('autocomplete')) {
                //fillInput(input, data[map.dataKey]); // Use fillInput for selects and autocompletes
                await queueFillInputs(input,data[map.dataKey]);
            } else if (input.type !== 'file') { // Prevent setting value on file inputs here
                //fillInput(input, data[map.dataKey]); // Use fillInput for regular inputs
                await queueFillInputs(input,data[map.dataKey]);
            }
            break; // Move to the next input after finding a match
        }
    }
    console.log('Fill address field function ends.')
}

const fieldMappings = [
    { keywords: [/email/], dataKey: 'email', type: 'text' },
    { keywords: [/first.*name/], dataKey: 'firstname', type: 'text' },
    { keywords: [/middle.*name/], dataKey: 'middlename', type: 'text' },
    { keywords: [/last.*name/], dataKey: 'lastname', type: 'text' },
    {keywords: [/(country.+code)/,/(phone.+code)/], dataKey: 'residencountry' , type: 'code',handleCountryCode: true},
    { keywords: [/(phone|mobile|telephone)/], dataKey: 'phonenumber', type: 'text', handleCountryCode: true },
    { keywords: [/date.*of.*birth/], dataKey: 'dateofbirth', type: 'date' },
    { keywords: [/linkedin/], dataKey: 'linkedin', type: 'text' },
    { keywords: [/github/], dataKey: 'github', type: 'text' },
    { keywords: [/resume/, /cv/], dataKey: 'resume', type: 'file' },
    { keywords: [/race/, /ethnicity/], dataKey: 'race', type: 'radio' },
    { keywords: [/degree/], dataKey: 'degree', type: 'text' },
    { keywords: [/major/], dataKey: 'major', type: 'text' },
    { keywords: [/school.*name/,/college.*name/,/university.*name/], dataKey: 'school', type: 'text' },
    { keywords: [/start.*date/], dataKey: 'startdate', type: 'date' },
    { keywords: [/end.*date/], dataKey: 'enddate', type: 'date' },
    { keywords: [/cgpa/], dataKey: 'cgpa', type: 'text' },
    { keywords: [/skills/], dataKey: 'skills', type: 'textarea' },
    { keywords: [/job.*title/, /job.*name/], dataKey: 'jobname', type: 'text' },
    { keywords: [/(duties|responsibilities|description)/], dataKey: 'jobduties', type: 'textarea' },
    { keywords: [/currently.*working/], dataKey: 'currentlyworking', type: 'checkbox' },
    { keywords: [/currently.*studying/], dataKey: 'currentlystudying', type: 'checkbox' },
    { keywords: [/sponsor/,/spsor/], dataKey: 'needsponsorship', type: 'checkbox' },
    { keywords: [/veteran/,/military/], dataKey: 'veteran', type: 'checkbox' },
    { keywords: [/disability/, /disable/], dataKey: 'disability', type: 'checkbox' },
    { keywords: [/gender/], dataKey: 'gender', type: 'radio' },
    { keywords: [/address/, /city/, /town/, /zip/, /postal/, /location/, /state/, /country/,], dataKey: 'dummy', type: 'address' },
    { keywords: [/name/, /fullname/], dataKey: 'fullname', type: 'text' },
];

const inputSelection=function(){
    let inputFields = []
    document.querySelectorAll('input[type="file"]').forEach(input => {
        const wrapper = input.closest('div, label, section, span');
        console.log('wrapper found',wrapper);
        console.log('input',input);
        if (wrapper) {
            const button = wrapper.querySelector('button');
            console.log('button found',button);
            if (button) {
                console.log('pushing file input',input);
                inputFields.push(input);
            }
            /*&& (
                wrapper.textContent.toLowerCase().includes('resume') || 
                button.textContent.toLowerCase().includes('resume') ||
                input.textContent.toLowerCase().includes('resume')
            )*/
        }
    });


    const otherFields = document.querySelectorAll(
        'input[type="text"], ' +
        'input[type="email"], ' +
        'input[type="date"], ' +
        'input[type="tel"], ' +
        'input[type="number"], ' +
        'input[type="checkbox"], ' +
        'input[type="radio"], ' +
        'input[type="password"], ' +
        'input[type="search"], ' +
        'select, ' +
        'textarea, ' +
        '[contenteditable="true"], ' +
        'input:not([type])'  // fallback for inputs without type
    );
    inputFields.push(...otherFields);
    return inputFields;

}

async function populateFields(inputFields,data) {
    console.log('populate started');
    if (!data) {
        console.log('No data');
        return;
    }
    const normalizedData = {};
    for (const key in data) {
        normalizedData[normalizeFieldName(key)] = data[key]; // norm key like : firstname
    }
    autofillData = normalizedData; // Assign to the global autofillData.
    const processedRadioGroups = new Set();
    for (const input of inputFields) {
        input.focus();
        simulateMouseMove(input);
        let cleared = false;
        if(!cleared && input.type === 'text'){
            
            input.value = " ";
            console.log("input Element is cleared");

        }
        cleared = true;
        // Skip if element is disabled or read-only at this stage too
        if (input.disabled || input.readOnly) {
            console.log(`Skipping disabled/read-only input:`, input);
            continue;
        }
        if((input.type == 'radio' || input.type == 'checkbox') && input.closest('fieldset')){
            const parentFieldset = input.closest('fieldset');
            if (processedRadioGroups.has(parentFieldset)){
                continue;

            }
            else{
                processedRadioGroups.add(parentFieldset);
            }

        }

        //Skipping if already autofilled during this session)prevents refilling on subsequent observer runs);
        if(input.getAttribute('data-autofilled') == 'true'){
            continue;
        }
        const normalizedInputName = inputFieldSelection(input);

    
        console.log('N.IN in populate:',normalizedInputName);
        const mapping = fieldMappings.find(m => m.keywords.some(rx => rx.test(normalizedInputName)));
        console.log('mapping matched in populate', mapping);

        // Check if mapping exists AND if the dataKey exists in normalizedData
        if (mapping &&  (mapping.type === 'address' || normalizedData.hasOwnProperty(mapping.dataKey))) {
            const val = normalizedData[mapping.dataKey] || '';
            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await delay(50); //small delay after scroll for visibility
            input.classList.add('autofill-highlight');
            input.setAttribute('data-autofilled','true');
            if (mapping.type === 'file' && input.type === 'file' && normalizedInputName.includes('resume')  && isParseResumeInut(input)) {
                 //await buttonselecting(input,val);
                 //await delay(30000); //Longer delay after potential resume parsing for server response
                continue;
            }
            else if (mapping.type === 'file' && input.type === 'file' && normalizedInputName.includes('resume') ) {
                try {
                    console.log('starting file input filling');
                    await handleFileInput(input,val);
                    await delay(1000);
                } catch (e) {
                    console.log('Error handling file input:', e);
                }
            } else if (mapping.type === 'address') {
                console.log("Address field starting.");
                //simulateMouseMove(input);
                //input.click();
                //await delay(50);
                const sectionPrefix = getSectionPrefix(input);
                fillAddressFields(input,normalizedData,sectionPrefix);
                console.log('Address field is completed.');
            } else if (mapping.type === 'date') {
                fillInput(input, formatDate(val)); // Use fillInput to trigger events
            } else if (mapping.type === 'code' && !mapping.handleCountryCode  && mapping.dataKey === 'phonenumber') {
                const countryCodeSelect = input.previousElementSibling;
                if (countryCodeSelect && countryCodeSelect.tagName.toUpperCase() === 'SELECT') {
                    const parts = String(val).match(/^\+?(\d{1,3})?(\d+)$/);
                    if (parts && parts[1]) {
                        const extractedCode = parts[1];
                        const mainNumber = parts[2];
                        let codeFound = false;
                        for (const option of countryCodeSelect.options) {
                            if (option.value.includes(extractedCode)) {
                                option.selected = true;
                                countryCodeSelect.dispatchEvent(new Event('change', { bubbles: true })); // Trigger change on country code select
                                await queueFillInputs(input, mainNumber); // Use fillInput for the main number field
                                codeFound = true;
                                break;
                            }
                        }
                        if (!codeFound) { // Fallback if country code option not found
                           await queueFillInputs(input,val);
                        }
                    } else {
                        await queueFillInputs(input,val);
                    }
                } else {
                    await queueFillInputs(input,val);
                }
            } else {
                await queueFillInputs(input,val); // Use await here, as fillInput itself can be async
            }
            setTimeout(()=>{input.classList.remove('autofill-highlight');},250); //short delay for highlighting removal.

            // Ensure events are dispatched after value setting, especially for non-autofillInput calls
            // (fillInput already handles this, but good to have for robustness if skipping fillInput)
            input.dispatchEvent(new Event('input', { bubbles: true })); // Redundant if fillInput is used
            input.dispatchEvent(new Event('change', { bubbles: true })); // Redundant if fillInput is used

            await delay(200);
        }
    }
    //hasAutofilled = true; // Mark as autofilled after the first pass

    //Reconnect the observer after autofill is complete
    //observer.observe(document.body,{childList: true, subtree: true});
    //console.log('Mutation observer reconnected.');
}
function delay(ms){
    return new Promise (res => setTimeout(res,ms));
}

function simulateMouseMove(el){
    const rect = el.getBoundingClientRect();
    const x = rect.left + (Math.random() * rect.width);
    const y = rect.top + (Math.random()* rect.height);
    el.dispatchEvent(new MouseEvent('mousemove',{clientX: x,clientY:y, bubbles: true}));
}
// Initialization and Entry Point
export async function autofillInit(token, dataFromPopup = null) {

    if (hasAutofilled) return;
    hasAutofilled = true;
    console.log('Autofill init called with token');
    document.head.appendChild(style);
    
    if (dataFromPopup) {
        console.log('Using autofill data from popup injection.');
        autofillData = dataFromPopup;
        const currentInputs = inputSelection();
        await populateFields(currentInputs,dataFromPopup);
    
    } else {
        console.warn('No data provided to autofillInit. Autofill may fail.');
    }

    //observer.observe(document.body, { childList: true, subtree: true });
    //console.log('Initial Mutation observer started.');
}



//Mutation observer to detect step transtions.
let observerTimeout = null;
let observer = new MutationObserver(()=>{

    //Clearing any existing timeout to debounce the function call
    clearTimeout(observerTimeout);
    observerTimeout = setTimeout(()=>{
        console.log('Mutations detected. Checking for new fields to populate.');
        if(autofillData){
            const allCurrentInputs = inputSelection();
            const unfilledInputs = Array.from(allCurrentInputs).filter(input =>!input.getAttribute('data-autofilled') || input.getAttribute('data-autofilled')==='false')

            const fillableUnfilledInputs = Array.from(unfilledInputs).filter(input => !input.disabled && !input.readOnly);
            if(fillableUnfilledInputs.length>0){
                console.log(`Found ${unfilledInputs.length} new/unfilled inputs. Attempting to populate.`);
                const err = new Error('Autofill called from the observer');
                console.log(err.stack);
                populateFields(fillableUnfilledInputs,autofillData);
            }
            else{
                console.log('No new/unfilled inputs found after mutation');
            }
        }
    },500); //Debounce delay: waiting 500ms before processing mutations.
}) 
//start observing initially
// Ensure the script only runs once if it's designed as such