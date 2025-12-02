# 🛠️ Category အသစ် ဘယ်လိုတိုးမလဲ?

(ဥပမာ - "Education" Category တိုးနည်း)

Category အသစ်တစ်ခု တိုးချင်ရင် ဖိုင် (၂) ဖိုင် မှာ ပြင်ဆင်ဖို့ လိုအပ်ပါတယ်။ ဥပမာအနေနဲ့ **Education** ဆိုတဲ့ Category တစ်ခု တိုးကြည့်ကြပါစို့။

---

## 📄 အဆင့် (က) - `index.html` တွင် (၂) နေရာ ထည့်ပါ

### **1. Sidebar မှာ Link ထည့်ပါ:**
```html
<ul class="nav-links">
    ...
    <!-- အသစ်ထည့်သည် -->
    <li onclick="filterCategory('education')" id="nav-education">
        <i class="fas fa-graduation-cap"></i> Education
    </li>
    ...
</ul>
```

### **2. Add/Edit Modal (Dropdown) မှာ Option ထည့်ပါ:**
```html
<select id="docCategory" onchange="updateFolderList()">
    ...
    <!-- အသစ်ထည့်သည် -->
    <option value="education">Education / School</option>
    ...
</select>
```

---

## ⚙️ အဆင့် (ခ) - `app.js` တွင် Title သတ်မှတ်ပါ
`filterCategory` function ထဲက **titles** စာရင်းမှာ UI မှာ ပြသမယ့် Title ကို ထည့်ပေးရပါမယ်။

```javascript
function filterCategory(category) {
    ...
    const titles = { 
        'all': 'All Documents', 
        'housing': 'Housing',
        'travel': 'Travel',
        // 👇 ဒီနေရာမှာ အသစ်ထည့်ပါ
        'education': 'Education Documents',
        'other': 'Others'
    };
    ...
}
```

---

✔️ ဒီ ၂ ဖိုင် ပြင်ရုံနဲ့ Category အသစ်တစ်ခု အလုပ်လုပ်သွားပါမယ်။
