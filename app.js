// State Management
let state = {
    account: null, // { name, id, avatarBase64 }
    currencies: [], // [{ id, name, icon, animIcon, creatorId, totalMinted, totalGoldSpent }]
    communityVotes: [] // [ goldPerUsdNumber ]
};

// Supabase Initialization
const supabaseUrl = 'https://kscfzslfeetgxhtwwqjx.supabase.co';
const supabaseKey = 'sb_publishable_5vTtJ0MCGJWu1i2-JSSeJg_pIQeKWLx';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// Load State from LocalStorage and Supabase
async function loadState() {
    // 1. First, load from localStorage so UI is fast
    const savedAccount = localStorage.getItem('cc_app_account');
    if (savedAccount) {
        state.account = JSON.parse(savedAccount);
    }

    // Update UI early
    updateUI();

    // 2. Fetch global currencies and votes
    try {
        const { data: curData, error: curError } = await supabaseClient.from('currencies').select('*');
        if (curData) state.currencies = curData;

        const { data: voteData, error: voteError } = await supabaseClient.from('community_votes').select('goldPerUsdNumber');
        if (voteData) state.communityVotes = voteData.map(v => v.goldPerUsdNumber);
    } catch (err) {
        console.error('Failed to load global data:', err);
    }

    // 3. Refresh our own account if we have one
    if (state.account && state.account.id) {
        try {
            const { data, error } = await supabaseClient
                .from('accounts')
                .select('*')
                .eq('id', state.account.id)
                .single();
            
            if (data) {
                state.account = data;
                localStorage.setItem('cc_app_account', JSON.stringify(state.account));
            }
        } catch (err) {
            console.error('Error fetching account from Supabase:', err);
        }
    }
    
    updateUI();
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

    const newAcc = {
        name,
        id: generatedId,
        avatarBase64
    };

    // Save to Supabase
    const { error } = await supabaseClient.from('accounts').insert(newAcc);
    if (error) {
        alert('Failed to create account in database. ' + error.message);
        return;
    }

    state.account = newAcc;
    localStorage.setItem('cc_app_account', JSON.stringify(newAcc));
    updateUI();
    
    alert('Account created successfully!');
    showSection('currencySection');
});

// Login Logic
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const loginId = document.getElementById('loginId').value.trim();
    const errorEl = document.getElementById('loginError');
    
    errorEl.classList.add('hidden');
    
    if (!loginId) return;

    const { data, error } = await supabaseClient
        .from('accounts')
        .select('*')
        .eq('id', loginId)
        .single();
        
    if (error || !data) {
        errorEl.classList.remove('hidden');
    } else {
        state.account = data;
        localStorage.setItem('cc_app_account', JSON.stringify(data));
        updateUI();
        alert('Logged in successfully!');
        showSection('currencySection');
    }
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

    const newCurrency = {
        id,
        name,
        icon: iconBase64,
        animIcon: animIconBase64,
        creatorId: state.account.id,
        totalMinted: 0,
        totalGoldSpent: 0
    };

    const { error } = await supabaseClient.from('currencies').insert(newCurrency);
    if (error) {
        alert('Failed to save currency to database. ' + error.message);
        return;
    }

    state.currencies.push(newCurrency);
    updateUI();
    
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
            const currencyIndex = state.currencies.findIndex(c => c.id === currencyId);
            if (currencyIndex !== -1) {
                const currency = state.currencies[currencyIndex];
                currency.totalMinted += 1; // 1 Custom Currency
                currency.totalGoldSpent += goldAmount;
                
                await supabaseClient.from('currencies')
                    .update({ 
                        totalMinted: currency.totalMinted, 
                        totalGoldSpent: currency.totalGoldSpent 
                    })
                    .eq('id', currency.id);
                    
                updateUI();

                statusEl.className = 'status-msg success';
                statusEl.innerText = `Successfully minted 1 ${currency.name}!`;

                // Show Acquired Animation
                showAcquiredModal(currency);
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
document.getElementById('voteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const gold = parseFloat(document.getElementById('goldPerUsd').value);
    if (!isNaN(gold) && gold > 0) {
        const { error } = await supabaseClient.from('community_votes').insert({ goldPerUsdNumber: gold });
        if (error) {
            alert('Failed to submit vote. ' + error.message);
            return;
        }
        
        state.communityVotes.push(gold);
        updateUI();
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
        document.getElementById('mintBtn').disabled = state.currencies.length === 0;
        document.getElementById('mintWarning').style.display = state.currencies.length === 0 ? 'block' : 'none';
    } else {
        profileEl.classList.add('hidden');
        document.getElementById('createCurrencyBtn').disabled = true;
        document.getElementById('currAccountWarning').style.display = 'block';
        document.getElementById('mintBtn').disabled = true;
        document.getElementById('mintWarning').style.display = 'block';
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

    state.currencies.forEach(c => {
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
    if (state.communityVotes.length > 0) {
        const sum = state.communityVotes.reduce((a, b) => a + b, 0);
        avgGoldPerUsd = sum / state.communityVotes.length;
    }
    
    document.getElementById('avgGoldPerUsd').innerText = avgGoldPerUsd.toFixed(2);
    document.getElementById('voteCount').innerText = state.communityVotes.length;

    if (valSelect.value) {
        updateValuationStats(valSelect.value, avgGoldPerUsd);
    }
}

function updateValuationStats(currencyId, avgGoldPerUsd = null) {
    if (avgGoldPerUsd === null) {
        if (state.communityVotes.length > 0) {
            const sum = state.communityVotes.reduce((a, b) => a + b, 0);
            avgGoldPerUsd = sum / state.communityVotes.length;
        } else {
            avgGoldPerUsd = 0;
        }
    }

    const currency = state.currencies.find(c => c.id === currencyId);
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
