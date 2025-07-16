// script.js

// --- Configuration (Replace with your actual project details) ---
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const SUPABASE_EDGE_FUNCTION_URL = 'YOUR_SUPABASE_EDGE_FUNCTION_URL'; // e.g., 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-waste'
const CONTRACT_ADDRESS = 'YOUR_SMART_CONTRACT_ADDRESS'; // Address of your deployed Solidity contract
const WEB3_PROVIDER_URL = 'YOUR_WEB3_PROVIDER_URL'; // e.g., Infura, Alchemy URL for your blockchain network
const TOKEN_2BC_DECIMALS = 18; // Standard for ERC-20 tokens

// Import necessary libraries (these would be loaded via script tags or a module bundler)
// Example: import { createClient } from '@supabase/supabase-js';
// Example: import Web3 from 'web3';
// Example: import contractABI from './contractABI.json'; // ABI of your deployed smart contract

// Supabase Client Initialization
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Web3 Provider Initialization
let web3;
let smartContract;

// Function to initialize Web3 and Smart Contract
async function initWeb3AndContract() {
    if (window.ethereum) {
        web3 = new Web3(window.ethereum);
        try {
            // Request account access if needed
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            smartContract = new web3.eth.Contract(contractABI, CONTRACT_ADDRESS);
            console.log("Web3 and Smart Contract initialized!");
        } catch (error) {
            console.error("User denied account access or other Web3 error:", error);
        }
    } else if (WEB3_PROVIDER_URL) {
        // Fallback for environments without MetaMask (read-only operations)
        web3 = new Web3(new Web3.providers.HttpProvider(WEB3_PROVIDER_URL));
        smartContract = new web3.eth.Contract(contractABI, CONTRACT_ADDRESS);
        console.log("Web3 initialized with HTTP provider (read-only).");
    } else {
        console.warn("Non-Ethereum browser detected. You should consider trying MetaMask!");
    }
}

// Call initWeb3AndContract on page load
document.addEventListener('DOMContentLoaded', initWeb3AndContract);

// --- User Authentication with Supabase Magic Link ---

/**
 * Sends a magic link to the user's email for authentication.
 * @param {string} email - The user's email address.
 * @returns {Promise<boolean>} - True if link sent successfully, false otherwise.
 */
async function sendMagicLink(email) {
    try {
        const { error } = await supabase.auth.signInWithOtp({
            email: email,
            options: {
                emailRedirectTo: window.location.origin // Redirect back to your app
            }
        });

        if (error) {
            console.error('Error sending magic link:', error.message);
            alert('Failed to send magic link: ' + error.message);
            return false;
        } else {
            alert('Magic link sent to your email! Please check your inbox.');
            return true;
        }
    } catch (err) {
        console.error('Unexpected error in sendMagicLink:', err);
        return false;
    }
}

/**
 * Handles user sign out.
 */
async function signOutUser() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Error signing out:', error.message);
            alert('Failed to sign out: ' + error.message);
        } else {
            alert('You have been signed out.');
            // Optionally redirect or update UI
            window.location.reload();
        }
    } catch (err) {
        console.error('Unexpected error in signOutUser:', err);
    }
}

// Listen for authentication state changes (useful for updating UI)
supabase.auth.onAuthStateChange((event, session) => {
    console.log('Supabase Auth Event:', event, 'Session:', session);
    if (session) {
        // User is logged in
        // Update UI to show logged-in state, display user email etc.
    } else {
        // User is logged out
        // Update UI to show login/signup options
    }
});

// --- Waste Transformation & Blockchain Interaction ---

/**
 * Processes waste data by calling a Supabase Edge Function.
 * This function acts as a secure intermediary for blockchain interactions.
 * @param {object} wasteData - Object containing waste details (e.g., type, weight, photos).
 * @returns {Promise<object>} - Response from the Edge Function (e.g., blockchain transaction hash, NFT metadata).
 */
async function processWasteData(wasteData) {
    try {
        const user = supabase.auth.getUser();
        if (!user) {
            alert("Please log in to process waste data.");
            return;
        }

        // Add user's wallet address if connected via MetaMask
        const accounts = await web3.eth.getAccounts();
        const userWalletAddress = accounts.length > 0 ? accounts[0] : null;

        const response = await fetch(SUPABASE_EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}` // Securely pass user session token
            },
            body: JSON.stringify({
                ...wasteData,
                user_wallet_address: userWalletAddress
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Edge Function error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('Waste processing successful:', result);
        alert('Waste processed! Check console for details.');
        return result;

    } catch (error) {
        console.error('Error processing waste data via Edge Function:', error);
        alert('Failed to process waste: ' + error.message);
        return null;
    }
}

// --- Smart Contract (Token and NFT) Interactions ---

// Example Smart Contract ABI (simplified for illustration)
// In a real scenario, this would be a large JSON object imported from your compiled contract.
const contractABI = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_to",
                "type": "address"
            },
            {
                "internalType": "string",
                "name": "_productType",
                "type": "string"
            },
            {
                "internalType": "uint256",
                "name": "_carbonReduction",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "_energyYield",
                "type": "uint256"
            },
            {
                "internalType": "string",
                "name": "_uri",
                "type": "string"
            }
        ],
        "name": "awardProductNFT",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_to",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "mint2BCToken",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
    // ... other functions like balanceOf, ownerOf, etc.
];


/**
 * Awards a Product NFT to a user after successful waste verification.
 * This function would typically be called by the Supabase Edge Function internally,
 * not directly by the client, for security and gas optimization.
 * But for demonstration, here's how it would look.
 * @param {string} toAddress - The recipient's Ethereum address.
 * @param {string} productType - Type of product (e.g., "BioProtein", "RecycledPlastic").
 * @param {number} carbonReduction - CO2e reduction in kg.
 * @param {number} energyYield - Energy generated in kWh.
 * @param {string} ipfsUri - IPFS URI for the NFT metadata.
 * @returns {Promise<object>} - Transaction receipt.
 */
async function awardProductNFT(toAddress, productType, carbonReduction, energyYield, ipfsUri) {
    if (!smartContract || !web3) {
        alert("Web3 or Smart Contract not initialized. Please connect your wallet.");
        return;
    }
    const accounts = await web3.eth.getAccounts();
    if (accounts.length === 0) {
        alert("No Ethereum account found. Please connect MetaMask.");
        return;
    }
    const fromAddress = accounts[0]; // The account sending the transaction (likely the contract owner or a relayer)

    try {
        const tx = await smartContract.methods.awardProductNFT(
            toAddress,
            productType,
            web3.utils.toBN(carbonReduction * 1000), // Scale for decimals if contract expects
            web3.utils.toBN(energyYield * 1000), // Scale for decimals
            ipfsUri
        ).send({ from: fromAddress });
        console.log('NFT Awarded Transaction:', tx);
        return tx;
    } catch (error) {
        console.error('Error awarding NFT:', error);
        throw error; // Re-throw to be handled by the calling function
    }
}

/**
 * Mints 2BC tokens for a user based on carbon reduction.
 * Similar to NFT, this should ideally be handled by the Edge Function for security.
 * @param {string} toAddress - The recipient's Ethereum address.
 * @param {number} tokensToMint - Number of 2BC tokens to mint.
 * @returns {Promise<object>} - Transaction receipt.
 */
async function mint2BCToken(toAddress, tokensToMint) {
    if (!smartContract || !web3) {
        alert("Web3 or Smart Contract not initialized. Please connect your wallet.");
        return;
    }
    const accounts = await web3.eth.getAccounts();
    if (accounts.length === 0) {
        alert("No Ethereum account found. Please connect MetaMask.");
        return;
    }
    const fromAddress = accounts[0]; // The account sending the transaction

    try {
        // Convert tokensToMint to the contract's expected format (e.g., with 18 decimals)
        const amount = web3.utils.toBN(tokensToMint).mul(web3.utils.toBN(10).pow(web3.utils.toBN(TOKEN_2BC_DECIMALS)));

        const tx = await smartContract.methods.mint2BCToken(
            toAddress,
            amount
        ).send({ from: fromAddress });
        console.log('2BC Token Minted Transaction:', tx);
        return tx;
    } catch (error) {
        console.error('Error minting 2BC tokens:', error);
        throw error;
    }
}


// --- Event Listeners and UI Interactions (Example) ---

document.addEventListener('DOMContentLoaded', () => {
    // Example: Hook up a login button
    const loginForm = document.getElementById('loginForm'); // Assume you have a form with an email input
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = loginForm.querySelector('input[type="email"]');
            await sendMagicLink(emailInput.value);
        });
    }

    // Example: Hook up a waste submission button
    const wasteSubmitButton = document.getElementById('submitWasteBtn'); // Assume a button for submitting waste
    if (wasteSubmitButton) {
        wasteSubmitButton.addEventListener('click', async () => {
            // Collect waste data from your form fields
            const wasteType = document.querySelector('select.form-control').value;
            const wasteWeight = parseFloat(document.querySelector('input[type="number"]').value);

            const wasteData = {
                type: wasteType,
                weight: wasteWeight,
                // Add more fields like photo uploads (which would go to IPFS first)
            };

            const result = await processWasteData(wasteData);
            if (result) {
                // Update UI with results, show success message, etc.
                console.log("Waste processed successfully. Result:", result);
            }
        });
    }

    // Example: Calculator functionality (as in your HTML)
    const familyMembersInput = document.querySelector('.calculator .form-group input[type="number"]');
    const wasteTypeSelect = document.querySelector('.calculator .form-group select.form-control');
    const wasteWeightInput = document.querySelector('.calculator .form-group input[type="number"][step="0.1"]');
    const calculateBtn = document.querySelector('.calculator .btn-primary');

    const co2Span = document.getElementById('co2');
    const tokensSpan = document.getElementById('tokens');
    const tokenValueSpan = document.getElementById('token-value');
    const productIncomeSpan = document.getElementById('product-income');
    const totalIncomeSpan = document.getElementById('total-income');

    // Simple calculation logic (replace with more accurate models if needed)
    calculateBtn.addEventListener('click', () => {
        const familyMembers = parseInt(familyMembersInput.value);
        const selectedWasteType = wasteTypeSelect.value;
        const wasteWeight = parseFloat(wasteWeightInput.value);

        let co2Reduction = 0;
        let productIncome = 0;

        // Simplified logic based on your HTML examples
        if (selectedWasteType.includes('Organik')) {
            co2Reduction = wasteWeight * (1.5 / 1.96); // Scale based on your example
            productIncome = 0; // Organic is not directly tied to product income in your example
        } else if (selectedWasteType.includes('Non-Organik')) {
            co2Reduction = 1.176; // Example value
            productIncome = 67200; // Example value
        } else if (selectedWasteType.includes('Produk Upcycle')) {
            co2Reduction = 1.5;
            productIncome = 600000;
        } else if (selectedWasteType.includes('Produk Seni')) {
            co2Reduction = 0.75;
            productIncome = 600000;
        } else if (selectedWasteType.includes('B3')) {
            co2Reduction = 0.294;
            productIncome = 30000;
        } else if (selectedWasteType.includes('Residu')) {
            co2Reduction = 0.294;
            productIncome = 4500;
        } else if (selectedWasteType.includes('e-Waste')) {
            co2Reduction = 0.15;
            productIncome = 60000;
        }

        // Adjust per month values
        co2Reduction *= 30; // Per month
        const tokens = co2Reduction * 10; // 10 tokens per kg CO2e
        const tokenValue = tokens * 50; // Assuming 1 token = Rp 50 (example)

        const totalIncome = productIncome + tokenValue;

        co2Span.textContent = co2Reduction.toFixed(2);
        tokensSpan.textContent = tokens.toFixed(2);
        tokenValueSpan.textContent = tokenValue.toLocaleString('id-ID'); // Format as Rupiah
        productIncomeSpan.textContent = productIncome.toLocaleString('id-ID');
        totalIncomeSpan.textContent = totalIncome.toLocaleString('id-ID');
    });

    // Initial calculation on load
    calculateBtn.click();
});
