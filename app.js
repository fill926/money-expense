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
let currentView = 'main'; 
let historyMode = 'month'; 
let activeRecordType = 'expense';

// UI Elements - General
const loginScreen = document.getElementById('loginScreen');
const appScreen = document.getElementById('appScreen');
const loginForm = document.getElementById('loginForm');
const walletIdInput = document.getElementById('walletIdInput');

// UI Elements - Main View
const mainView = document.getElementById('mainView');
const displayWalletId = document.getElementById('displayWalletId');
const logoutBtn = document.getElementById('logoutBtn');
const totalAmountEl = document.getElementById('totalAmount');
const totalIncomeEl = document.getElementById('totalIncome');
const totalExpenseEl = document.getElementById('totalExpense');

// Form Elements
const expenseForm = document.getElementById('expenseForm');
const submitBtn = document.getElementById('submitBtn');
const btnExpense = document.getElementById('btnExpense');
const btnIncome = document.getElementById('btnIncome');
const categorySelect = document.getElementById('category');

const recentExpenseList = document.getElementById('recentExpenseList');
const goToHistoryBtn = document.getElementById('goToHistoryBtn');

// UI Elements - History View
const historyView = document.getElementById('historyView');
const backToMainBtn = document.getElementById('backToMainBtn');
const historyMonthFilter = document.getElementById('historyMonthFilter');
const showAllTimeBtn = document.getElementById('showAllTimeBtn');
const historyTotalLabel = document.getElementById('historyTotalLabel');
const historyTotalAmount = document.getElementById('historyTotalAmount');
const historyTotalIncomeEl = document.getElementById('historyTotalIncome');
const historyTotalExpenseEl = document.getElementById('historyTotalExpense');
const fullExpenseList = document.getElementById('fullExpenseList');
const expenseDateInput = document.getElementById('expenseDate');

// Data Kategori
const expenseCategories = ['Lunch', 'Dinner', 'Snacks', 'Sports', 'Savings', 'Investment', 'Medical', 'Transportation', 'Other Expense'];
const incomeCategories = ['Salary', 'Bonus', 'Allowance', 'Other Income'];

// Setup Default Dates
const todayStr = new Date().toISOString().split('T')[0];
const currentMonthStr = todayStr.substring(0, 7);
expenseDateInput.value = todayStr;
historyMonthFilter.value = currentMonthStr;

// Formatters
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Math.abs(amount));
};

const formatDateUI = (dateString) => {
    const dateObj = new Date(dateString);
    return dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); 
};

// ---------------- Toggle Button & Category Logic ---------------- //

function updateCategoryOptions() {
    categorySelect.innerHTML = '<option value="" disabled selected>Select...</option>';
    const categories = activeRecordType === 'income' ? incomeCategories : expenseCategories;
    
    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        categorySelect.appendChild(opt);
    });
}

function setRecordType(type) {
    activeRecordType = type;
    if (type === 'expense') {
        btnExpense.className = "flex-1 py-2.5 text-sm font-semibold rounded-lg bg-white shadow-sm text-red-500 transition-all";
        btnIncome.className = "flex-1 py-2.5 text-sm font-semibold rounded-lg text-gray-500 hover:text-gray-700 transition-all";
    } else {
        btnIncome.className = "flex-1 py-2.5 text-sm font-semibold rounded-lg bg-white shadow-sm text-green-600 transition-all";
        btnExpense.className = "flex-1 py-2.5 text-sm font-semibold rounded-lg text-gray-500 hover:text-gray-700 transition-all";
    }
    updateCategoryOptions();
}

btnExpense.addEventListener('click', () => setRecordType('expense'));
btnIncome.addEventListener('click', () => setRecordType('income'));

// Initialize categories
updateCategoryOptions();

// ---------------- HTML Template for List Items ---------------- //

const createExpenseHTML = (data) => {
    const bankDisplay = data.bankType ? data.bankType : 'N/A';
    const recordType = data.type || 'expense';
    const isIncome = recordType === 'income';
    
    const sign = isIncome ? '+' : '-';
    const amountColorClass = isIncome ? 'text-green-600' : 'text-red-500';

    return `
        <div class="group flex justify-between items-center p-3 hover:bg-gray-50 rounded-xl border border-transparent hover:border-gray-100 transition-colors">
            <div class="flex items-center gap-3 w-full">
                <div class="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex flex-col items-center justify-center shrink-0 shadow-sm border border-blue-100">
                    <span class="text-[10px] font-bold uppercase leading-none">${formatDateUI(data.date).split(' ')[1]}</span>
                    <span class="text-sm font-black leading-none mt-0.5">${formatDateUI(data.date).split(' ')[0]}</span>
                </div>
                <div class="flex-1 min-w-0 ml-1">
                    <p class="text-sm font-semibold text-gray-800 truncate">${data.note}</p>
                    <p class="text-[11px] text-gray-500 font-medium">${data.category} • ${bankDisplay}</p>
                </div>
                <div class="text-right">
                    <p class="text-sm font-bold ${amountColorClass}">${sign} ${formatCurrency(data.amount)}</p>
                    <button class="delete-btn text-[11px] font-semibold text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 mt-1 block w-full text-right" data-id="${data.id}">
                        Delete
                    </button>
                </div>
            </div>
        </div>
    `;
};

// ---------------- Navigation & Listeners ---------------- //

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = walletIdInput.value.trim().toLowerCase();
    if(id) {
        currentWalletId = id;
        displayWalletId.textContent = currentWalletId;
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        loadData();
    }
});

logoutBtn.addEventListener('click', () => {
    if(unsubscribe) unsubscribe();
    currentWalletId = "";
    walletIdInput.value = "";
    appScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    switchView('main');
});

goToHistoryBtn.addEventListener('click', () => {
    switchView('history');
});

backToMainBtn.addEventListener('click', () => {
    switchView('main');
});

historyMonthFilter.addEventListener('change', () => {
    historyMode = 'month';
    historyMonthFilter.classList.remove('opacity-50');
    showAllTimeBtn.classList.replace('bg-blue-600', 'bg-blue-50');
    showAllTimeBtn.classList.replace('text-white', 'text-blue-600');
    historyTotalLabel.textContent = `Balance in ${historyMonthFilter.value}`;
    loadData();
});

showAllTimeBtn.addEventListener('click', () => {
    historyMode = 'all';
    historyMonthFilter.classList.add('opacity-50');
    showAllTimeBtn.classList.replace('bg-blue-50', 'bg-blue-600');
    showAllTimeBtn.classList.replace('text-blue-600', 'text-white');
    historyTotalLabel.textContent = "Balance All Time";
    loadData();
});

function switchView(view) {
    currentView = view;
    if (view === 'main') {
        historyView.classList.add('hidden');
        mainView.classList.remove('hidden');
    } else {
        mainView.classList.add('hidden');
        historyView.classList.remove('hidden');
        if (historyMode === 'all') {
            historyTotalLabel.textContent = "Balance All Time";
        } else {
            historyTotalLabel.textContent = `Balance in ${historyMonthFilter.value}`;
        }
    }
    loadData();
}

// ---------------- Database Logic ---------------- //

function loadData() {
    if(unsubscribe) unsubscribe();

    let q;
    
    if (currentView === 'main') {
        q = query(collection(db, "wallets", currentWalletId, "expenses"), where("month", "==", currentMonthStr));
        recentExpenseList.innerHTML = '<p class="text-center text-gray-400 text-sm py-4">Loading...</p>';
    } else {
        if (historyMode === 'all') {
            q = query(collection(db, "wallets", currentWalletId, "expenses"));
        } else {
            q = query(collection(db, "wallets", currentWalletId, "expenses"), where("month", "==", historyMonthFilter.value));
        }
        fullExpenseList.innerHTML = '<p class="text-center text-gray-400 text-sm py-4">Loading...</p>';
    }

    unsubscribe = onSnapshot(q, (snapshot) => {
        let expenses = [];
        let totalIncome = 0;
        let totalExpense = 0;

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const recordType = data.type || 'expense'; 
            
            if (recordType === 'income') {
                totalIncome += Number(data.amount);
            } else {
                totalExpense += Number(data.amount);
            }

            expenses.push({ id: docSnap.id, ...data });
        });

        const netBalance = totalIncome - totalExpense;

        expenses.sort((a, b) => {
            if (a.date !== b.date) return a.date > b.date ? -1 : 1;
            return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
        });

        if (currentView === 'main') {
            totalAmountEl.textContent = formatCurrency(netBalance);
            totalIncomeEl.textContent = formatCurrency(totalIncome);
            totalExpenseEl.textContent = formatCurrency(totalExpense);
            
            totalAmountEl.className = netBalance < 0 ? 'text-3xl font-bold text-red-500' : 'text-3xl font-bold text-gray-800';

            recentExpenseList.innerHTML = '';
            if(expenses.length === 0) {
                recentExpenseList.innerHTML = '<p class="text-center text-gray-400 text-sm py-4">No records for this month.</p>';
            } else {
                const top3 = expenses.slice(0, 3);
                top3.forEach((data) => {
                    recentExpenseList.innerHTML += createExpenseHTML(data);
                });
            }
        } else {
            historyTotalAmount.textContent = formatCurrency(netBalance);
            historyTotalIncomeEl.textContent = formatCurrency(totalIncome);
            historyTotalExpenseEl.textContent = formatCurrency(totalExpense);
            
            historyTotalAmount.className = netBalance < 0 ? 'text-2xl font-bold text-red-500' : 'text-2xl font-bold text-gray-800';

            fullExpenseList.innerHTML = '';
            if(expenses.length === 0) {
                fullExpenseList.innerHTML = '<p class="text-center text-gray-400 text-sm py-4">No records found.</p>';
            } else {
                expenses.forEach((data) => {
                    fullExpenseList.innerHTML += createExpenseHTML(data);
                });
            }
        }

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if(confirm('Delete this record?')) {
                    await deleteDoc(doc(db, "wallets", currentWalletId, "expenses", id));
                }
            });
        });
    });
}

// Add New Record (Income or Expense)
expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const selectedDate = document.getElementById('expenseDate').value;
    const amount = document.getElementById('amount').value;
    const category = document.getElementById('category').value;
    const bankType = document.getElementById('bankType').value;
    const note = document.getElementById('note').value;
    const monthStr = selectedDate.substring(0, 7);

    submitBtn.innerHTML = 'Saving...';
    submitBtn.disabled = true;

    try {
        await addDoc(collection(db, "wallets", currentWalletId, "expenses"), {
            type: activeRecordType, 
            date: selectedDate,
            month: monthStr,
            amount: Number(amount),
            category: category,
            bankType: bankType,
            note: note,
            createdAt: serverTimestamp()
        });
        
        document.getElementById('amount').value = '';
        document.getElementById('category').value = '';
        document.getElementById('bankType').value = '';
        document.getElementById('note').value = '';
    } catch (error) {
        console.error(error);
        alert("Failed to save data.");
    } finally {
        submitBtn.innerHTML = 'Add Record';
        submitBtn.disabled = false;
    }
});
