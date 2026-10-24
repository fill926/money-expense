import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
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

function loadExpenses() {
    const q = query(collection(db, "wallets", currentWalletId, "expenses"), orderBy("createdAt", "desc"));
    
    expenseList.innerHTML = '<p class="text-center text-gray-400 text-sm py-4"><i class="fas fa-spinner fa-spin"></i> Loading data...</p>';

    unsubscribe = onSnapshot(q, (snapshot) => {
        expenseList.innerHTML = '';
        let total = 0;

        if(snapshot.empty) {
            expenseList.innerHTML = '<p class="text-center text-gray-400 text-sm py-4">No records yet.</p>';
            totalAmountEl.textContent = 'Rp 0';
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            total += Number(data.amount);

            const div = document.createElement('div');
            div.className = 'group flex justify-between items-center p-3 hover:bg-gray-50 rounded-xl border border-transparent hover:border-gray-100 transition-colors';
            div.innerHTML = `
                <div class="flex items-center gap-3 w-full">
                    <div class="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                        <i class="fas ${getIcon(data.category)}"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold text-gray-800 truncate">${data.note}</p>
                        <p class="text-xs text-gray-500">${data.category}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-sm font-bold text-red-500">-${formatCurrency(data.amount)}</p>
                        <button class="delete-btn text-xs text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 mt-1" data-id="${docSnap.id}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
            expenseList.appendChild(div);
        });

        totalAmountEl.textContent = formatCurrency(total);

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.closest('button').getAttribute('data-id');
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
    
    const amount = document.getElementById('amount').value;
    const category = document.getElementById('category').value;
    const note = document.getElementById('note').value;
    
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    submitBtn.disabled = true;

    try {
        await addDoc(collection(db, "wallets", currentWalletId, "expenses"), {
            amount: Number(amount),
            category: category,
            note: note,
            createdAt: serverTimestamp()
        });
        
        expenseForm.reset();
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
