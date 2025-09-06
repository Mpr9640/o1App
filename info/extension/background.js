// background.js — MV3-safe, non-blocking, embedding included

import { pipeline} from '@huggingface/transformers';
import apiClient from "../src/axios.js";
import {
  tokenize, stopWords, removeStopWords, stemWord, stemTokens,
  extractKeywords, predefinedSkillsList, getRecognizedSkills,
  getSkillsFromStorage, findIntersection, calculateSkillsMatchingPercentage
} from './scripts/skillmatching.js';
// ===== Embedding pipeline =====
let extractorPromise = null;
async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true, progress_callback: (p) => console.log('[transformers]', p),use_cache: true, });
    console.log('Embedding model preloaded succesfully');
    
  }
  return extractorPromise;
}

function meanPoolAndNormalize(tensor) {
  const { dims, data } = tensor;
  if (!dims || dims.length !== 3) throw new Error(`Unexpected tensor dims: ${dims}`);
  const [batch, tokens, hidden] = dims;
  if (batch !== 1) throw new Error('meanPoolAndNormalize expects batch=1');
  const out = new Float32Array(hidden);
  for (let t = 0; t < tokens; t++) {
    const base = t * hidden;
    for (let h = 0; h < hidden; h++) out[h] += data[base + h];
  }
  const inv = 1 / Math.max(1, tokens);
  for (let h = 0; h < hidden; h++) out[h] *= inv;
  const norm = Math.sqrt(out.reduce((sum, v) => sum + v*v, 0)) || 1;
  for (let h = 0; h < hidden; h++) out[h] /= norm;
  return Array.from(out);
}
function cosineSim(a, b) {
  return a.reduce((sum, v, i) => sum + v * b[i], 0);
}

async function embedOne(text) {
  const extractor = await getExtractor();
  const output = await extractor(text);
  return meanPoolAndNormalize(output);
}

async function embedMany(texts) {
  const out = [];
  for (const t of texts) out.push(await embedOne(t));
  return out;
}

// ===== Backend / storage =====
async function fetchDataFromBackend() {
  try {
    const response = await apiClient.get('api/candidate', { withCredentials: true });
    const data = response.data;
    data['residence_location'] = `${data['residence_city']},${data['residence_state']}`;
    data['school_location'] = `${data['school_city']},${data['school_state']}`;
    data['job_location'] = `${data['job_city']},${data['job_state']}`;
    await chrome.storage.local.set({ autofillData: data });
    console.log('Fetched latest data from backend:', data);
    return data;
  } catch (e) {
    console.error("Error fetching candidate data:", e);
    return null;
  }
}

async function fetchResumeFile(fileUrl) {
  try {
    const res = await fetch(fileUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    const filename = fileUrl.split('/').pop() || 'autofilled_file';
    return new File([blob], filename, { type: blob.type });
  } catch (e) {
    console.error('Error fetching resume file:', e);
    return null;
  }
}

// ===== Unified message listener =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      if (request.action === 'openPopup') {
        chrome.action.openPopup();
        fetchDataFromBackend();
        sendResponse({ success: true, message: 'Popup opened.' });
      } else if (request.action === 'fetching cookie') {
        const response = await apiClient.post('/api/refresh', { withCredentials: true });
        sendResponse({ success: true, data: response.data });
      } else if (request.action === 'fetchResume') {
        const file = await fetchResumeFile(request.fileUrl);
        if (file) {
          const reader = new FileReader();
          reader.onload = () => sendResponse({ success: true, fileData: reader.result, filename: file.name, type: file.type ||"application/pdf" });
          reader.onerror = () => sendResponse({ success: false, error: 'Failed to read file' });
          reader.readAsDataURL(file);
        } else sendResponse({ success: false, error: 'Failed to fetch file' });
        return true; //keep sendResponse async
      } else if (request.action === 'jdText' && request.text) {
        const allExtractedKeywords = extractKeywords(request.text);
        const jobRecognizedSkills  = getRecognizedSkills(allExtractedKeywords);
        const userSkillSet         = await getSkillsFromStorage();
        const matchedWords         = findIntersection(jobRecognizedSkills, userSkillSet);
        const percentage           = calculateSkillsMatchingPercentage(jobRecognizedSkills, userSkillSet);

        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, {
            action: 'displayPercentage',
            percentage,
            matchedWords: [...matchedWords]
          });
        }
        sendResponse({ status: 'Job text processed.' });
      } else if (request.type === 'embed') {
        const embedding = await embedOne(request.text || '');
        sendResponse({ ok: true, embedding });
      } else if (request.type === 'embeds') {
        const embeddings = await embedMany(request.texts || []);
        sendResponse({ ok: true, embeddings });
      } else if (request.type === 'bestMatch') {
        const { text, labels } = request;
        const [qVec, labelVecs] = await Promise.all([embedOne(text || ''), embedMany(labels || [])]);
        let bestIdx = -1, bestScore = -Infinity;
        for (let i = 0; i < labelVecs.length; i++) {
          const s = cosineSim(qVec, labelVecs[i]);
          if (s > bestScore) { bestScore = s; bestIdx = i; }
        }
        // ✅ Only return label if score >= 0.7
        if (bestScore >= 0.5) {
          sendResponse({
            ok: true,
            index: bestIdx,
            label: labels?.[bestIdx] ?? null,
            score: bestScore
          });
        } else {
          sendResponse({
            ok: true,
            index: -1,
            label: null,
            score: bestScore
          });
        }
        sendResponse({ ok: true, index: bestIdx, label: labels?.[bestIdx] ?? null, score: bestScore });
      } else {
        sendResponse({ ok: false, error: 'Unknown request type' });
      }
    } catch (e) {
      console.error('Background listener error:', e);
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
  })();
  return true; // keep async channel open
});

// Periodic backend sync
setInterval(fetchDataFromBackend, 10*60*1000);

console.log('Background service worker initialized.');
