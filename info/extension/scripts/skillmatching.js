/*export function tokenize(text){
    return text.toLowerCase().split(/\W+/).filter(Boolean);
}*/
// A simple stop word list (you can expand this significantly)
export function tokenize(text){
    return text.toString().toLowerCase().replace(/\s/g, '').trim();
}
/*export const stopWords = new Set([
    "a", "an", "the", "and", "or", "but", "is", "are", "was", "were", "to", "of", "in", "for",
    "on", "with", "as", "by", "at", "from", "be", "have", "has", "had", "do", "does", "did",
    "will", "would", "can", "could", "may", "might", "must", "should", "we", "you", "he",
    "she", "it", "they", "this", "that", "these", "those", "etc", "experience", "skills",
    "ability", "work", "strong", "knowledge", "proven", "demonstrated", "years", 
    "plus", "required", "preferred", "role", "responsibilities",
    "design", "manage", "build", "implement", "support", "collaborate", "ensure", "drive",
    "understand", "excellent", "good", "new", "senior", "junior", "lead", "team", "solutions",
    "system", "systems","technical", "business", "client",
    "clients", "product", "products", "project", "projects", "tools", "technologies", "technology",
    "framework", "frameworks", "environment", "environments", "applications", "application",
    "across", "within", "through", "upon", "about", "also", "just", "then", "its", "our", "their",
    "your", "us", "him", "her", "them", "which", "what", "where", "when", "why", "how", "such",
    "only", "very", "much", "more", "most", "less", "least", "well", "out", "up", "down", "off",
    "on", "about", "into", "onto", "from", "for", "against", "among", "amongst", "around", "behind",
    "below", "beneath", "beside", "besides", "between", "beyond", "during", "except", "inside",
    "like", "near", "outside", "over", "past", "since", "than", "until", "upon", "without",
    "worth", "along", "amid", "amidst", "around", "concerning", "despite", "excepting",
    "following", "including", "instead", "minus", "outside", "per", "plus", "regarding",
    "save", "toward", "towards", "under", "unlike", "versus", "via", "within", "without","type","language",
    "technology","technologies","server",
]);


export function removeStopWords(tokens){
    return tokens.filter(token =>!stopWords.has(token));
}
export function stemWord(word){
    if(word.endsWith('ing')) return word.slice(0,-3);
    if(word.endsWith('ed')) return word.slice(0,-2);
    return word;
}
export function stemTokens(tokens){
    return tokens.map(stemWord);
}*/
export function extractKeywords(text){
    let tokens = tokenize(text);
    console.log('tokenized text',tokens);
    //tokens = removeStopWords(tokens);
    //console.log('after removing stop words',tokens);
    //tokens = stemTokens(tokens);
    //console.log('After stemming',tokens);
    //return new Set(tokens);
    return tokens;
}
// --- Predefined Skill List for Filtering ---
/*export const predefinedSkillsList = new Set([
    "machine","ml","python", "java","c++", "javascript","js",
    "go", "ruby", "swift", "kotlin", "php", "rust", "typescript", "script",
    "c#", "web", "html", "css", "react", "angular",
    "vue.js",".net" ,"node.js", "express.js", "django", "flask", "ruby",
    "cloud", "aws", "azure", "google cloud platform ","gcp","psql",
    "database", "sql", "mysql", "postgresql", "mongodb", "cassandra",
    "redis", "oracle","data science", "machine learning",
    "r", "pandas", "numpy", "scikit-learn", "tensorflow", "keras", "pytorch",
    "data visualization", "statistical modeling", "predictive analytics",
    "devops", "ci/cd", "docker", "kubernetes", "jenkins", "gitlab ci",
    "github actions", "ansible", "terraform", "operating systems", "linux",
    "windows server", "macos", "networking", "tcp/ip", "dns", "routing", "firewalls",
    "vpns", "cybersecurity", "penetration testing", "incident response", "network security",
    "cryptography", "compliance", "mobile development", "ios", "android", "react native",
    "flutter", "version control", "git", "github", "gitlab", "bitbucket", "apis",
    "restful", "soap", "graphql", "software development life cycle", "sdlc",
    "testing", "unit testing", "integration testing", "end-to-end testing",
    "qa", "cloud security", "big data technologies", "hadoop", "spark", "kafka",
    "communication", "verbal", "written", "active listening", "teamwork", "collaboration",
    "problem-solving", "critical thinking", "adaptability", "flexibility", "time management",
    "organization", "leadership", "conflict resolution", "emotional intelligence",
    "interpersonal skills", "networking", "mentoring", "negotiation", "empathy", "persuasion",
    "presentation skills", "feedback", "coaching", "active listening", "project management",
    "agile", "scrum", "waterfall", "pmp", "prince2", "strategic planning", "budgeting", "financial management",
    "risk management", "change management", "process improvement", "business analysis", "market research",
    "customer relationship management", "crm", "sales", "marketing strategy",
    "data analysis", "reporting", "performance management", "resource allocation",
    "stakeholder management", "decision-making", "vendor management",
    "supply chain management", "graphic design", "adobe creative suite",
    "photoshop", "illustrator", "indesign", "ui/ux design", "user interface",
    "user experience", "wireframing", "prototyping", "figma", "sketch", "adobe xd",
    "content creation", "writing", "video production", "photography", "storytelling",
    "creative thinking", "illustration", "animation", "web design", "visual", "layout",
    "branding", "statistical analysis", "data cleaning", "preprocessing", "data visualization",
    "tableau", "power bi", "d3.js", "database management", "sql querying", "spreadsheet software",
    "microsoft excel", "google sheets", "pivot tables", "vlookup", "a/b testing", "reporting",
    "business intelligence", "bi", "etl", "extract", "transform", "load", "research skills",
    "foreign languages", "public speaking", "customer service", "troubleshooting",
    "training", "development", "attention to detail", "work ethic", "integrity", "initiative",
    "adaptability to new technologies", "learning agility"
]); */
export const predefinedSkillsList = new Set([
    "machinelearn","ml","python", "java","c++", "javascript","js",
    "go", "ruby", "swift", "kotlin", "php", "rust", "typescript","scripting",
    "c#", "web", "html", "css", "react", "angular","bashing",
    "vue",".net" ,"node", "express", "django", "flask", "ruby",
    "cloud", "aws", "azure", "googlecloudplatform ","gcp","psql",
    "database", "sql", "mysql", "postgresql", "mongodb", "cassandra",
    "redis", "oracle","datascience", "network","science",
    "r", "pandas", "numpy", "scikitlearn", "tensorflow", "keras", "pytorch",
    "datavisualization", "statisticalmodel", "predictiveanalytics",
    "devops", "ci/cd", "ci","cd","docker", "kubernetes", "jenkins", "gitlab ci",
    "github actions", "ansible", "terraform", "operatingsystem","os", "linux",
    "windowsserver", "macos", "network", "tcp/ip", "dns", "routing", "firewall",
    "vpns", "cybersecurity", "penetrationtest", "incidentresponse", "networksecurity",
    "cryptography", "compliance", "mobiledevelopment", "ios", "android", "native",
    "flutter", "versioncontrol", "git", "github", "gitlab", "bitbucket", "apis",
    "restful", "soap", "graphql", "softwaredevelopmentlifecycle", "sdlc",
    "testing", "unittesting", "integrationtesting", "endtoendtesting",
    "qa", "cloudsecurity", "bigdatatechnologies", "hadoop", "spark", "kafka",
    "communication", "verbal", "written", "activelisten", "teamwork", "collaboration",
    "problem-solving", "criticalthink", "adaptability", "flexibility", "timemanage",
    "organization", "leadership", "conflictresolution", "emotionalintelligence",
    "interpersonalskill", "networking", "mentoring", "negotiation", "empathy", "persuasion",
    "presentationskill", "feedback", "coaching", "activelisten", "projectmanage",
    "agile", "scrum", "waterfall", "pmp", "prince2", "strategicplan", "budgeting", "financialmanage",
    "riskmanage", "changemanage", "processimprove", "businessanalysis", "marketresearch",
    "customerrelationshipmanage", "crm", "sales", "marketingstrategy",
    "dataanalysis", "reporting", "performancemanagement", "resourceallocation",
    "stakeholdermanage", "decisionmaking", "vendormanage","ui","ux",
    "supplychainmanage", "graphicdesign", "adobecreativesuite",
    "photoshop", "illustrator", "indesign", "ui/uxdesign", "userinterface",
    "userexperience", "wirefram", "prototyp", "figma", "sketch", "adobexd",
    "content creation", "writing", "videoproduction", "photography", "storytelling",
    "creativethink", "illustration", "animation", "webdesign", "visual", "layout",
    "branding", "statisticalanalysis", "datacleaning", "preprocessing", "datavisualization",
    "tableau", "powerbi", "d3.js", "databasemanagement", "sqlquery", "spreadsheetsoftware",
    "microsoftexcel", "googlesheet", "pivottable", "vlookup", "a/btest", "report",
    "businessintelligence", "powerbi", "etl", "extract", "transform", "load", "researchskill",
    "foreignlanguage", "publicspeak", "customerservice", "troubleshoot",
    "train", "softwaredevelop", "attention", "workethic", "integrity", "initiative",
    "adaptability", "learningagility","softwareengineer"
]);

/*export function getRecognizedSkills(processedKeywords){
    const recognizedSkills = new Set();
    for(const keyword of processedKeywords){
        if(predefinedSkillsList.has(keyword)){
            recognizedSkills.add(keyword);
        }
    }
    console.log('recognizedSkills',recognizedSkills);
    return recognizedSkills;
}*/
export function getRecognizedSkills(tokens){
    const recognizedSkills = new Set();
    for(const keyword of predefinedSkillsList){
        if(tokens.includes(keyword)){
            recognizedSkills.add(keyword);
        }
    }
    console.log('recognized skills',recognizedSkills);
    return recognizedSkills;
}
export async function getSkillsFromStorage() {
    return new Promise((resolve) => {
        chrome.storage.local.get('autofillData', (result) => {
            if (result && result.autofillData && typeof result.autofillData.skills === 'string') {
                const skillsString = result.autofillData.skills;
                const skillsList = skillsString.split(',')
                                               .map(skill => skill.trim().toLowerCase().replace(/\s/g, '')) // Trim whitespace and lowercase for consistent matching
                                               .filter(skill => skill !== ''); // Remove empty strings

                const skillsSet = new Set(skillsList);
                console.log('userSkills',skillsSet);
                resolve(skillsSet);
            } else {
                console.warn("User skills not found or not in expected format in chrome.storage.local.autofillData.skills");
                resolve(null);
            }
        });
    });
}
export function findIntersection(setA,setB){
    const intersection = new Set();
    for(const item of setA){
        if(setB.has(item)){
            intersection.add(item);
        }
    }
    return intersection;
}
export function calculateSkillsMatchingPercentage(jobRecognizedSkills,userSkillSet){
    if(!userSkillSet || userSkillSet.size === 0){
        console.log('No user skills found');
        return 0;
    }
    else if(jobRecognizedSkills.size === 0){
        console.log('No jobFinalKeywords.')
        return 0;
    }
    const matchedWords = findIntersection(jobRecognizedSkills, userSkillSet);
    const matchingPercentage = (matchedWords.size /jobRecognizedSkills.size)*100;

    console.log(`Matched Skills: ${[...matchedWords].join(',')}`);
    console.log(`Job recognized Skills Count: ${jobRecognizedSkills.size}`);
    console.log(`User Skills Count: ${userSkillSet.size}`);
    console.log(`Matching Percentage: ${matchingPercentage.toFixed(2)}%`);

    return matchingPercentage;


}

