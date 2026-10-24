import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, where, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDEPfwXfGxPBTK3xVxIKNKdfOw7cHzD8_o",
    authDomain: "catatan-pengeluaran-e8807.firebaseapp.com",
    projectId: "catatan-pengeluaran-e8807",
    storageBucket: "catatan-pengeluaran-e8807.firebasestorage.app",
    messagingSenderId: "662914862726",
    appId: "1:662914862726:web:f5b13503cad0a108804b07"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let currentWalletId = "";
let unsubscribe = null;

// UI Elements
const loginScreen = document.getElementById('loginScreen');
const appScreen = document.getElementById('appScreen');
const loginForm = document.getElementById('loginForm');
const walletIdInput = document.getElementById('walletIdInput');
const displayWalletId = document.getElementById('displayWalletId');
const logoutBtn = document.getElementById('logoutBtn');
const expenseForm = document.getElementById('expenseForm');
const submitBtn = document.getElementById('submitBtn');
const expenseList = document.getElementById('expenseList');
const totalAmountEl = document.getElementById('totalAmount');

const expenseDateInput = document.getElementById('expenseDate');
const monthFilterInput = document.getElementById('monthFilter');

// Set default date to Today
const todayStr = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
expenseDateInput.value = todayStr;

// Set default month filter to Current Month
const currentMonthStr = todayStr.substring(0, 7); // Format: YYYY-MM
monthFilterInput.value = currentMonthStr;

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
};

const formatDateUI = (dateString) => {
    const dateObj = new Date(dateString);
    return dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); // Example: 24 Oct
};

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = walletIdInput.value.trim().toLowerCase();
    if(id) {
        currentWalletId = id;
        displayWalletId.textContent = currentWalletId;
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        loadExpenses();
    }
});

logoutBtn.addEventListener('click', () => {
    if(unsubscribe) unsubscribe();
    currentWalletId = "";
    walletIdInput.value = "";
    appScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    expenseList.innerHTML = '';
    totalAmountEl.textContent = 'Rp 0';
});

// Reload data if month filter changes
monthFilterInput.addEventListener('change', () => {
    if(currentWalletId) {
        loadExpenses();
    }
});

function loadExpenses() {
    if(unsubscribe) unsubscribe(); // Stop previous listener

    const selectedMonth = monthFilterInput.value; // Format: "YYYY-MM"
    
    // Query expenses for the selected month only
    const q = query(
        collection(db, "wallets", currentWalletId, "expenses"),
        where("month", "==", selectedMonth)
    );
    
    expenseList.innerHTML = '<p class="text-center text-gray-400 text-sm py-4"><i class="fas fa-spinner fa-spin"></i> Loading data...</p>';

    unsubscribe = onSnapshot(q, (snapshot) => {
        let expenses = [];
        let total = 0;

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            total += Number(data.amount);
            expenses.push({ id: docSnap.id, ...data });
        });

        // Sort data by Date (newest first), then by CreatedAt
        expenses.sort((a, b) => {
            if (a.date !== b.date) return a.date > b.date ? -1 : 1;
            return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
        });

        expenseList.innerHTML = '';

        if(expenses.length === 0) {
            expenseList.innerHTML = '<p class="text-center text-gray-400 text-sm py-4">No records found for this month.</p>';
            totalAmountEl.textContent = 'Rp 0';
            return;
        }

        expenses.forEach((data) => {
            const div = document.createElement('div');
            div.className = 'group flex justify-between items-center p-3 hover:bg-gray-50 rounded-xl border border-transparent hover:border-gray-100 transition-colors';
            div.innerHTML = `
                <div class="flex items-center gap-3 w-full">
                    <div class="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex flex-col items-center justify-center shrink-0 shadow-sm border border-blue-100">
                        <span class="text-[10px] font-bold uppercase leading-none">${formatDateUI(data.date).split(' ')[1]}</span>
                        <span class="text-sm font-black leading-none mt-0.5">${formatDateUI(data.date).split(' ')[0]}</span>
                    </div>
                    <div class="flex-1 min-w-0 ml-1">
                        <p class="text-sm font-semibold text-gray-800 truncate">${data.note}</p>
                        <p class="text-[11px] text-gray-500 font-medium"><i class="fas ${getIcon(data.category)} mr-1"></i> ${data.category}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-sm font-bold text-red-500">-${formatCurrency(data.amount)}</p>
                        <button class="delete-btn text-xs text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 mt-1 block w-full text-right" data-id="${data.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            expenseList.appendChild(div);
        });

        totalAmountEl.textContent = formatCurrency(total);

        // Delete button listener
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if(confirm('Delete this record?')) {
                    await deleteDoc(doc(db, "wallets", currentWalletId, "expenses", id));
                }
            });
        });
    }, (error) => {
        console.error("Error loading data:", error);
        expenseList.innerHTML = `<p class="text-center text-red-400 text-sm py-4">Failed to load data. Ensure Firestore Rules are in Test mode.</p>`;
    });
}

expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const selectedDate = document.getElementById('expenseDate').value;
    const amount = document.getElementById('amount').value;
    const category = document.getElementById('category').value;
    const note = document.getElementById('note').value;
    
    // Extract month (YYYY-MM) from the selected date to help with filtering
    const monthStr = selectedDate.substring(0, 7);

    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    submitBtn.disabled = true;

    try {
        await addDoc(collection(db, "wallets", currentWalletId, "expenses"), {
            date: selectedDate, // Store the exact date
            month: monthStr,    // Store the month for grouping
            amount: Number(amount),
            category: category,
            note: note,
            createdAt: serverTimestamp()
        });
        
        // Reset only amount, category, and note. Keep the chosen date.
        document.getElementById('amount').value = '';
        document.getElementById('category').value = '';
        document.getElementById('note').value = '';
        
    } catch (error) {
        console.error("Error adding data:", error);
        alert("Failed to save. Make sure your Firestore is active and using Test Mode.");
    } finally {
        submitBtn.innerHTML = '<i class="fas fa-plus"></i> Add Expense';
        submitBtn.disabled = false;
    }
});

function getIcon(category) {
    switch(category) {
        case 'Food': return 'fa-hamburger';
        case 'Transportation': return 'fa-car';
        case 'Shopping': return 'fa-shopping-bag';
        case 'Entertainment': return 'fa-film';
        case 'Bills': return 'fa-file-invoice-dollar';
        default: return 'fa-box';
    }
}
