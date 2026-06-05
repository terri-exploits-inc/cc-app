// State Management
let state = {
    account: null, // { name, id, avatarBase64 }
    currencies: [], // [{ id, name, icon, animIcon, creatorId, totalMinted, totalGoldSpent }]
    communityVotes: [] // [ goldPerUsdNumber ]
};

let publicCurrencies = [];
let publicVotes = [];
let allAppStates = [];

// Supabase Initialization
const supabaseUrl = 'https://kscfzslfeetgxhtwwqjx.supabase.co';
const supabaseKey = 'sb_publishable_5vTtJ0MCGJWu1i2-JSSeJg_pIQeKWLx';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// Load State from LocalStorage and Supabase
async function loadState() {
    // 1. First, load from localStorage so UI is fast
    const saved = localStorage.getItem('cc_app_state');
    if (saved) {
        state = JSON.parse(saved);
        publicCurrencies = [...state.currencies];
        publicVotes = [...state.communityVotes];
        updateUI();
    }

    // 2. Fetch ALL states from Supabase to aggregate public data
    try {
        const { data, error } = await supabaseClient.from('app_state').select('*');
        if (!error && data) {
            allAppStates = data;
            
            // Reconstruct public data
            publicCurrencies = [];
            publicVotes = [];
            data.forEach(row => {
                if (row.state_data.currencies) publicCurrencies.push(...row.state_data.currencies);
                if (row.state_data.communityVotes) publicVotes.push(...row.state_data.communityVotes);
                
                // Also update local state if this is our account
                if (state.account && row.account_id === state.account.id) {
                    state = row.state_data;
                    localStorage.setItem('cc_app_state', JSON.stringify(state));
                }
            });
            updateUI();
            console.log('Successfully loaded global state from Supabase.');
        } else if (error) {
            console.warn('Failed to load global state:', error.message);
        }
    } catch (err) {
        console.error('Error fetching state from Supabase:', err);
    }
}

async function saveState() {
    localStorage.setItem('cc_app_state', JSON.stringify(state));
    updateUI();

    // Auto-save to Supabase
    if (state.account && state.account.id) {
        try {
            const { error } = await supabaseClient
                .from('app_state')
                .upsert({ 
                    account_id: state.account.id, 
                    state_data: state 
                }, { onConflict: 'account_id' });
            
            if (error) {
                console.warn('Supabase auto-save warning (Ensure table "app_state" exists with "account_id" and "state_data" columns):', error.message);
            } else {
                console.log('Auto-saved to Supabase successfully.');
            }
        } catch (err) {
            console.error('Failed to auto-save to Supabase:', err);
        }
    }
}

// Navigation Logic
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Remove active class from all
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        
        // Add active class to target
        e.target.classList.add('active');
        const targetId = e.target.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
    });
});

function showSection(id) {
    document.querySelector(`[data-target="${id}"]`).click();
}

// Utility: Read File as Data URL (Base64)
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve(null);
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
    });
}

// Utility: Setup Image Preview
function setupImagePreview(inputId, previewId) {
    document.getElementById(inputId).addEventListener('change', async (e) => {
        const file = e.target.files[0];
        const preview = document.getElementById(previewId);
        if (file) {
            const dataUrl = await readFileAsDataURL(file);
            preview.innerHTML = `<img src="${dataUrl}" alt="Preview">`;
        } else {
            preview.innerHTML = '';
        }
    });
}

setupImagePreview('accAvatar', 'avatarPreview');
setupImagePreview('currIcon', 'iconPreview');
setupImagePreview('currAnimIcon', 'animIconPreview');

// 1. Create Account Logic
document.getElementById('accountForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('accName').value.trim();
    const avatarFile = document.getElementById('accAvatar').files[0];
    
    if (!name || !avatarFile) return;

    // Generate ID
    const generatedId = 'ID-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const avatarBase64 = await readFileAsDataURL(avatarFile);

    state.account = {
        name,
        id: generatedId,
        avatarBase64
    };

    saveState();
    alert('Account created successfully!');
    showSection('currencySection');
});

// 2. Create Currency Logic
const currNameInput = document.getElementById('currName');
const currIdInput = document.getElementById('currId');

// Auto capitalize and generate ID on input
currNameInput.addEventListener('input', (e) => {
    let words = e.target.value.split(' ');
    
    // Rule: Must Have Only 1 Capital At The Beginning Of Each Word
    words = words.map(w => {
        if (w.length === 0) return '';
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    });
    
    const formattedName = words.join(' ');
    
    // Preserve cursor position roughly if needed, but for simplicity we'll just set it
    // We only force update on blur to avoid typing issues, or we can just update the ID live
    
    // Generate ID: Max 4 chars based on Name. 
    // We can take the first letter of each word, or just first 4 letters.
    let generatedId = '';
    const lettersOnly = formattedName.replace(/[^a-zA-Z]/g, '');
    if (words.length > 1) {
        // Take first letter of up to 4 words
        generatedId = words.filter(w=>w.length>0).slice(0, 4).map(w => w.charAt(0).toUpperCase()).join('');
    } else {
        // Just take first 4 letters
        generatedId = lettersOnly.substring(0, 4).toUpperCase();
    }
    
    currIdInput.value = generatedId;
});

currNameInput.addEventListener('blur', (e) => {
    // Force format on blur to ensure correct casing
    let words = e.target.value.split(' ').map(w => {
        if (w.length === 0) return '';
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    });
    e.target.value = words.join(' ');
});

document.getElementById('currencyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.account) return;

    const name = document.getElementById('currName').value.trim();
    const id = document.getElementById('currId').value;
    const iconFile = document.getElementById('currIcon').files[0];
    const animIconFile = document.getElementById('currAnimIcon').files[0];

    if (!name || !id || !iconFile) return;

    const iconBase64 = await readFileAsDataURL(iconFile);
    const animIconBase64 = await readFileAsDataURL(animIconFile);

    // Check if ID exists
    if (state.currencies.find(c => c.id === id)) {
        alert('A currency with this ID already exists. Try a different name.');
        return;
    }

    state.currencies.push({
        id,
        name,
        icon: iconBase64,
        animIcon: animIconBase64,
        creatorId: state.account.id,
        totalMinted: 0,
        totalGoldSpent: 0
    });
    
    // Add to public immediately for smooth UI
    publicCurrencies.push(state.currencies[state.currencies.length - 1]);

    saveState();
    
    // Reset form
    document.getElementById('currencyForm').reset();
    document.getElementById('iconPreview').innerHTML = '';
    document.getElementById('animIconPreview').innerHTML = '';
    
    alert('Currency created successfully!');
});

// 3. Minting Logic
document.getElementById('mintForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currencyId = document.getElementById('mintCurrencySelect').value;
    const goldAmount = parseFloat(document.getElementById('mintGoldAmount').value);
    
    const apiAccount = document.getElementById('apiAccount').value;
    const apiPassword = document.getElementById('apiPassword').value;
    const apiTarget = document.getElementById('apiTarget').value;

    if (!currencyId || isNaN(goldAmount) || goldAmount <= 0) return;

    const statusEl = document.getElementById('mintStatus');
    statusEl.className = 'status-msg loading';
    statusEl.innerText = 'Minting via Territorial.io API...';

    // Mocking the Territorial.io Game API fetch
    // ANY AMOUNT Gold = 1 Custom Currency
    try {
        // We use a CORS proxy to bypass browser restrictions and prevent console errors
        const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent('https://territorial.io/api/gold/send');
        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                account_name: apiAccount,
                password: apiPassword,
                target_account_name: apiTarget,
                amount: goldAmount
            })
        });

        if (response.ok) {
            // Update currency stats
            const currencyIndex = publicCurrencies.findIndex(c => c.id === currencyId);
            if (currencyIndex !== -1) {
                const pCurr = publicCurrencies[currencyIndex];
                pCurr.totalMinted += 1; // 1 Custom Currency
                pCurr.totalGoldSpent += goldAmount;

                // Update creator's state in Supabase
                const ownerStateRow = allAppStates.find(row => row.account_id === pCurr.creatorId);
                if (ownerStateRow) {
                    const ownerCurr = ownerStateRow.state_data.currencies.find(c => c.id === currencyId);
                    if (ownerCurr) {
                        ownerCurr.totalMinted = pCurr.totalMinted;
                        ownerCurr.totalGoldSpent = pCurr.totalGoldSpent;
                    }
                    
                    // If the creator is the current user, update local state too
                    if (pCurr.creatorId === state.account?.id) {
                        const localCurr = state.currencies.find(c => c.id === currencyId);
                        if (localCurr) {
                            localCurr.totalMinted = pCurr.totalMinted;
                            localCurr.totalGoldSpent = pCurr.totalGoldSpent;
                        }
                        saveState(); // Saves local state to localStorage and Supabase
                    } else {
                        // Save other user's state to Supabase
                        supabaseClient.from('app_state').upsert({
                            account_id: ownerStateRow.account_id,
                            state_data: ownerStateRow.state_data
                        }, { onConflict: 'account_id' }).then(({error}) => {
                            if (error) console.error('Failed to update creator state:', error);
                        });
                    }
                } else if (pCurr.creatorId === state.account?.id) {
                    // Fallback if allAppStates doesn't have it but we do
                    const localCurr = state.currencies.find(c => c.id === currencyId);
                    if (localCurr) {
                        localCurr.totalMinted = pCurr.totalMinted;
                        localCurr.totalGoldSpent = pCurr.totalGoldSpent;
                        saveState();
                    }
                }

                updateUI();

                statusEl.className = 'status-msg success';
                statusEl.innerText = `Successfully minted 1 ${pCurr.name}!`;

                // Show Acquired Animation
                showAcquiredModal(pCurr);
            }
        } else {
            throw new Error('API Response not OK');
        }
    } catch (error) {
        statusEl.className = 'status-msg error';
        statusEl.innerText = 'Minting failed. Check credentials or network.';
        console.error(error);
    }
});

function showAcquiredModal(currency) {
    const modal = document.getElementById('acquiredModal');
    const title = document.getElementById('acquiredTitle');
    const icon = document.getElementById('acquiredIcon');
    
    title.innerText = `1 ${currency.name} Acquired!`;
    icon.src = currency.animIcon || currency.icon; // Use animated if available
    
    modal.classList.remove('hidden');
}

window.closeAcquiredModal = function() {
    document.getElementById('acquiredModal').classList.add('hidden');
}

// 4. Valuation Logic
document.getElementById('voteForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const gold = parseFloat(document.getElementById('goldPerUsd').value);
    if (!isNaN(gold) && gold > 0) {
        state.communityVotes.push(gold);
        publicVotes.push(gold);
        saveState();
        document.getElementById('voteForm').reset();
    }
});

document.getElementById('valCurrencySelect').addEventListener('change', (e) => {
    updateValuationStats(e.target.value);
});

// Update UI
function updateUI() {
    // Profile
    const profileEl = document.getElementById('navProfile');
    if (state.account) {
        profileEl.classList.remove('hidden');
        document.getElementById('navName').innerText = state.account.name;
        document.getElementById('navId').innerText = state.account.id;
        document.getElementById('navAvatar').src = state.account.avatarBase64;
        
        document.getElementById('createCurrencyBtn').disabled = false;
        document.getElementById('currAccountWarning').style.display = 'none';
        
        const canMint = publicCurrencies.length > 0;
        document.getElementById('mintBtn').disabled = !canMint;
        const mintWarning = document.getElementById('mintWarning');
        if (!canMint) {
            mintWarning.style.display = 'block';
            mintWarning.innerText = 'No currencies available to mint.';
        } else {
            mintWarning.style.display = 'none';
        }
    } else {
        profileEl.classList.add('hidden');
        document.getElementById('createCurrencyBtn').disabled = true;
        document.getElementById('currAccountWarning').style.display = 'block';
        document.getElementById('mintBtn').disabled = true;
        
        const mintWarning = document.getElementById('mintWarning');
        mintWarning.style.display = 'block';
        mintWarning.innerText = 'You must create an account to mint.';
    }

    // Currencies List
    const listEl = document.getElementById('currenciesList');
    const mintSelect = document.getElementById('mintCurrencySelect');
    const valSelect = document.getElementById('valCurrencySelect');
    
    listEl.innerHTML = '';
    
    // Preserve selections
    const currentMintVal = mintSelect.value;
    const currentValVal = valSelect.value;

    mintSelect.innerHTML = '<option value="" disabled selected>Select a currency...</option>';
    valSelect.innerHTML = '<option value="" disabled selected>Select a currency...</option>';

    publicCurrencies.forEach(c => {
        // List item
        listEl.innerHTML += `
            <div class="currency-card">
                <img src="${c.icon}" alt="${c.name}">
                <h4>${c.name}</h4>
                <p><small>${c.id}</small></p>
            </div>
        `;
        
        // Select options
        mintSelect.innerHTML += `<option value="${c.id}">${c.name} (${c.id})</option>`;
        valSelect.innerHTML += `<option value="${c.id}">${c.name} (${c.id})</option>`;
    });

    if (currentMintVal) mintSelect.value = currentMintVal;
    if (currentValVal) valSelect.value = currentValVal;

    // Valuation stats
    let avgGoldPerUsd = 0;
    if (publicVotes.length > 0) {
        const sum = publicVotes.reduce((a, b) => a + b, 0);
        avgGoldPerUsd = sum / publicVotes.length;
    }
    
    document.getElementById('avgGoldPerUsd').innerText = avgGoldPerUsd.toFixed(2);
    document.getElementById('voteCount').innerText = publicVotes.length;

    if (valSelect.value) {
        updateValuationStats(valSelect.value, avgGoldPerUsd);
    }
}

function updateValuationStats(currencyId, avgGoldPerUsd = null) {
    if (avgGoldPerUsd === null) {
        if (publicVotes.length > 0) {
            const sum = publicVotes.reduce((a, b) => a + b, 0);
            avgGoldPerUsd = sum / publicVotes.length;
        } else {
            avgGoldPerUsd = 0;
        }
    }

    const currency = publicCurrencies.find(c => c.id === currencyId);
    const statsBox = document.getElementById('currencyStats');
    
    if (currency) {
        statsBox.classList.remove('hidden');
        document.getElementById('statTotalMinted').innerText = currency.totalMinted;
        document.getElementById('statTotalGold').innerText = currency.totalGoldSpent;
        
        let valueInGold = 0;
        if (currency.totalMinted > 0) {
            valueInGold = currency.totalGoldSpent / currency.totalMinted;
        }
        document.getElementById('statGoldValue').innerText = `${valueInGold.toFixed(2)} Gold`;
        
        let valueInUsd = 0;
        if (avgGoldPerUsd > 0) {
            valueInUsd = valueInGold / avgGoldPerUsd;
        }
        document.getElementById('statUsdValue').innerText = `$${valueInUsd.toFixed(2)}`;
    } else {
        statsBox.classList.add('hidden');
    }
}

// Initial Load
loadState();
