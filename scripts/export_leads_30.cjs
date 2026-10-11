const fs = require('fs');
const path = require('path');
const os = require('os');

const leads = [
  {
    "Business Name": "HALAL Fashion Mart",
    "Industry": "Wholesale & Retail Apparel (T-Shirts)",
    "District / Location": "Dhaka, Bangladesh",
    "Public Business Phone": "01840-398999",
    "Official Website": "https://halalfashionmart.com/",
    "Facebook Page URL": "https://www.facebook.com/HALALFashionMart/",
    "Source URL": "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BD&media_type=video&q=t-shirt",
    "Marketing Opportunity": "Active Meta video ads running combo offers; wholesale available via WhatsApp",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "Narana Lifestyle",
    "Industry": "Fashion Lifestyle & T-Shirts",
    "District / Location": "Agrabad, Chattogram, Bangladesh",
    "Public Business Phone": "01828-536666",
    "Official Website": "",
    "Facebook Page URL": "https://www.facebook.com/NaranaLifestyle/",
    "Source URL": "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BD&media_type=video&q=t-shirt",
    "Marketing Opportunity": "Active regional video campaign and in-store clearance promotion",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "Identic Outfit",
    "Industry": "Drop Shoulder & Menswear Wholesale/Retail",
    "District / Location": "Dhaka, Bangladesh",
    "Public Business Phone": "+880 1896-270587",
    "Official Website": "https://identicbd.com/",
    "Facebook Page URL": "https://www.facebook.com/identicoutfit/",
    "Source URL": "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BD&media_type=video&q=t-shirt",
    "Marketing Opportunity": "High-volume video conversion funnels targeting combo buyers",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "Menzline / Menz Line BD",
    "Industry": "Mens T-Shirts & Casual Wear",
    "District / Location": "Dhaka, Bangladesh",
    "Public Business Phone": "01335-110130",
    "Official Website": "https://menzlinebd.com/",
    "Facebook Page URL": "https://www.facebook.com/61566922887862/",
    "Source URL": "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BD&media_type=video&q=t-shirt",
    "Marketing Opportunity": "Running active video ads for drop-shoulder 4-pack combos",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "UrbanClub BD",
    "Industry": "Sports & Winter T-Shirts Wholesale/Retail",
    "District / Location": "Dhaka, Bangladesh",
    "Public Business Phone": "",
    "Official Website": "https://urbanclubbd.xyz/",
    "Facebook Page URL": "https://www.facebook.com/urbanclubbd/",
    "Source URL": "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BD&media_type=video&q=t-shirt",
    "Marketing Opportunity": "Active Meta video ads on China PP fabric t-shirts",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "Fabristyle BD",
    "Industry": "Menswear & Combo T-Shirts",
    "District / Location": "Dhaka, Bangladesh",
    "Public Business Phone": "",
    "Official Website": "https://fabristylebd.com/",
    "Facebook Page URL": "https://www.facebook.com/fabristyle.bd/",
    "Source URL": "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BD&media_type=video&q=t-shirt",
    "Marketing Opportunity": "Active 5pcs combo t-shirt video ad campaigns",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "Mentek",
    "Industry": "Drop Shoulder T-Shirts & Apparel",
    "District / Location": "Dhaka, Bangladesh",
    "Public Business Phone": "",
    "Official Website": "https://mentek.xyz/",
    "Facebook Page URL": "https://www.facebook.com/61583340166281/",
    "Source URL": "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BD&media_type=video&q=t-shirt",
    "Marketing Opportunity": "Emerging brand running targeted micro video campaigns",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "Menfit",
    "Industry": "Full Sleeve & Casual T-Shirts",
    "District / Location": "Dhaka, Bangladesh",
    "Public Business Phone": "",
    "Official Website": "https://menfit.xyz/",
    "Facebook Page URL": "https://www.facebook.com/61582705838411/",
    "Source URL": "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BD&media_type=video&q=t-shirt",
    "Marketing Opportunity": "Direct response landing page with active video ad promo",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "Go Garments",
    "Industry": "Garments & T-Shirt Wholesale (পাইকারি)",
    "District / Location": "Dhaka, Bangladesh",
    "Public Business Phone": "01306-927669",
    "Official Website": "",
    "Facebook Page URL": "https://www.facebook.com/gogarmentsbd/",
    "Source URL": "https://www.facebook.com/",
    "Marketing Opportunity": "Active WhatsApp-first wholesale t-shirt supplier",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "Magura Fashion House",
    "Industry": "Wholesale T-Shirts & Apparel (পাইকারি)",
    "District / Location": "Sector 12, Uttara, Dhaka, Bangladesh",
    "Public Business Phone": "01300-066368",
    "Official Website": "",
    "Facebook Page URL": "https://www.facebook.com/magurafashionhouse/",
    "Source URL": "https://www.facebook.com/",
    "Marketing Opportunity": "Wholesale hub supplying countrywide retailers via video showcase",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "Fashion Dazzling BD",
    "Industry": "Apparel & T-Shirt Wholesaler (পাইকারি)",
    "District / Location": "Rongdhonu Tower, Uttara, Dhaka, Bangladesh",
    "Public Business Phone": "01711-973792",
    "Official Website": "",
    "Facebook Page URL": "https://www.facebook.com/fashiondazzlingbd/",
    "Source URL": "https://www.facebook.com/",
    "Marketing Opportunity": "Active Uttara-based apparel wholesale distributor",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "Khandokar Garments",
    "Industry": "Wholesale T-Shirts & Menswear (পাইকারি)",
    "District / Location": "Nagar Plaza, Fulbaria, Dhaka, Bangladesh",
    "Public Business Phone": "01703-651425",
    "Official Website": "",
    "Facebook Page URL": "https://www.facebook.com/khandokargarments/",
    "Source URL": "https://www.facebook.com/",
    "Marketing Opportunity": "Major Fulbaria wholesale trader with active video catalogs",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "Next Collection",
    "Industry": "Wholesale T-Shirts & Menswear (পাইকারি)",
    "District / Location": "Dhaka Trade Centre, Gulistan, Dhaka, Bangladesh",
    "Public Business Phone": "01823-790516",
    "Official Website": "",
    "Facebook Page URL": "https://www.facebook.com/nextcollectionbd/",
    "Source URL": "https://www.facebook.com/",
    "Marketing Opportunity": "Gulistan wholesale supplier active on WhatsApp marketing",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "A.M Fashion & Garments",
    "Industry": "Wholesale Garments & T-Shirts (পাইকারি)",
    "District / Location": "City Plaza, Fulbaria, Gulistan, Dhaka, Bangladesh",
    "Public Business Phone": "01610-720363",
    "Official Website": "",
    "Facebook Page URL": "https://www.facebook.com/amfashiongarments/",
    "Source URL": "https://www.facebook.com/",
    "Marketing Opportunity": "City Plaza wholesaler with dedicated customer order line",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "Top Collection",
    "Industry": "Wholesale & Retail T-Shirts (পাইকারি)",
    "District / Location": "Shah Ali Market, Mirpur-1, Dhaka, Bangladesh",
    "Public Business Phone": "01302-826888",
    "Official Website": "",
    "Facebook Page URL": "https://www.facebook.com/topcollectionbd/",
    "Source URL": "https://www.facebook.com/",
    "Marketing Opportunity": "Mirpur market wholesale & retail supplier promoting via video",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "Smart Original Brand",
    "Industry": "Wholesale Menswear & T-Shirts (পাইকারি)",
    "District / Location": "Fulbaria Super Market, City Plaza, Dhaka, Bangladesh",
    "Public Business Phone": "01975-859249",
    "Official Website": "",
    "Facebook Page URL": "https://www.facebook.com/smartoriginalbrand/",
    "Source URL": "https://www.facebook.com/",
    "Marketing Opportunity": "High-volume wholesale t-shirt supplier in Gulistan",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "Galaxy Export Zone (Saiful Express Ltd)",
    "Industry": "Export T-Shirts & Wholesale (পাইকারি)",
    "District / Location": "Sector 10, Uttara, Dhaka, Bangladesh",
    "Public Business Phone": "01784-570000",
    "Official Website": "",
    "Facebook Page URL": "https://www.facebook.com/galaxyexportzone/",
    "Source URL": "https://www.facebook.com/",
    "Marketing Opportunity": "Export leftovers & custom batch wholesale provider",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "Wholesale Market BD",
    "Industry": "Wholesale Apparel & T-Shirts (পাইকারি)",
    "District / Location": "Pallabi, Mirpur, Dhaka, Bangladesh",
    "Public Business Phone": "01710-114142",
    "Official Website": "",
    "Facebook Page URL": "https://www.facebook.com/wholesalemarketbd/",
    "Source URL": "https://www.facebook.com/",
    "Marketing Opportunity": "Online wholesale portal for boutique owners and retailers",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "Repose",
    "Industry": "Custom Print & Wholesale T-Shirts (পাইকারি)",
    "District / Location": "Shah Ali School & College Market, Mirpur-1, Dhaka, Bangladesh",
    "Public Business Phone": "01747-038320",
    "Official Website": "",
    "Facebook Page URL": "https://www.facebook.com/reposebd/",
    "Source URL": "https://www.facebook.com/",
    "Marketing Opportunity": "Custom printing and bulk t-shirt supplier for brands",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "Uttara Wholesale Mart",
    "Industry": "Wholesale Garments & T-Shirts (পাইকারি)",
    "District / Location": "Uttara, Dhaka, Bangladesh",
    "Public Business Phone": "+880 1620-621656",
    "Official Website": "",
    "Facebook Page URL": "https://www.facebook.com/uttarawholesalemart/",
    "Source URL": "https://www.facebook.com/",
    "Marketing Opportunity": "Bulk apparel provider active on digital messaging channels",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "King Shop",
    "Industry": "T-Shirts & Apparel Wholesale/Retail",
    "District / Location": "New Market, Dhaka, Bangladesh",
    "Public Business Phone": "01790-283184",
    "Official Website": "",
    "Facebook Page URL": "https://www.facebook.com/kingshopbd/",
    "Source URL": "https://www.facebook.com/",
    "Marketing Opportunity": "New Market apparel trader supplying online shops",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "RaheDeen",
    "Industry": "Kids & Adult T-Shirts Wholesale (পাইকারি)",
    "District / Location": "Rupnagar R/A, Mirpur-7, Dhaka, Bangladesh",
    "Public Business Phone": "01915-628762",
    "Official Website": "",
    "Facebook Page URL": "https://www.facebook.com/rahedeenbd/",
    "Source URL": "https://www.facebook.com/",
    "Marketing Opportunity": "Kids & family combo t-shirt manufacturer & wholesaler",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "Original Export T-Shirt",
    "Industry": "Export Surplus T-Shirts (পাইকারি)",
    "District / Location": "Sector 9, Uttara, Dhaka, Bangladesh",
    "Public Business Phone": "01972-700174",
    "Official Website": "",
    "Facebook Page URL": "https://www.facebook.com/originalexporttshirt/",
    "Source URL": "https://www.facebook.com/",
    "Marketing Opportunity": "Wholesale export excess drop shoulder t-shirts",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "KSS Export Buying",
    "Industry": "Buying House & Wholesale T-Shirts (পাইকারি)",
    "District / Location": "Sector 11, Uttara, Dhaka, Bangladesh",
    "Public Business Phone": "01779-775551",
    "Official Website": "",
    "Facebook Page URL": "https://www.facebook.com/kssexportbuying/",
    "Source URL": "https://www.facebook.com/",
    "Marketing Opportunity": "Bulk production & buying house stocklots",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "AR Fashion Brand",
    "Industry": "Menswear & Wholesale T-Shirts (পাইকারি)",
    "District / Location": "Gulistan, Dhaka, Bangladesh",
    "Public Business Phone": "01873-337134",
    "Official Website": "",
    "Facebook Page URL": "https://www.facebook.com/arfashionbrand/",
    "Source URL": "https://www.facebook.com/",
    "Marketing Opportunity": "Video reviews & IMO/WhatsApp bulk ordering for resellers",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "Wisteria Shop",
    "Industry": "Fashion & T-Shirts Wholesale/Retail",
    "District / Location": "New Market City Complex, Dhaka, Bangladesh",
    "Public Business Phone": "01911-423442",
    "Official Website": "",
    "Facebook Page URL": "https://www.facebook.com/wisteriashopbd/",
    "Source URL": "https://www.facebook.com/",
    "Marketing Opportunity": "Retail complex trader running seasonal deals",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "MadBox",
    "Industry": "Cotton & Solid T-Shirts Wholesale (পাইকারি)",
    "District / Location": "Yunusco City Centre, CDA Avenue, Chattogram, Bangladesh",
    "Public Business Phone": "01558-920728",
    "Official Website": "",
    "Facebook Page URL": "https://www.facebook.com/madboxbd/",
    "Source URL": "https://www.facebook.com/",
    "Marketing Opportunity": "Chittagong-based organic cotton wholesale & retail supplier",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "Khoskhoshe / One Ummah BD",
    "Industry": "Premium & Customized T-Shirts Wholesale (পাইকারি)",
    "District / Location": "Manru Shopping City, Chouhatta, Sylhet, Bangladesh",
    "Public Business Phone": "01839-166029",
    "Official Website": "",
    "Facebook Page URL": "https://www.facebook.com/khoskhoshebd/",
    "Source URL": "https://www.facebook.com/",
    "Marketing Opportunity": "B2B tailored t-shirt supply for regional boutique brands",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "Rupkatha",
    "Industry": "Apparel & Bulk T-Shirts (পাইকারি)",
    "District / Location": "Dhaka, Bangladesh",
    "Public Business Phone": "01890-307941",
    "Official Website": "https://web.rupkatha.com.bd/",
    "Facebook Page URL": "https://www.facebook.com/rupkathabd/",
    "Source URL": "https://web.rupkatha.com.bd/",
    "Marketing Opportunity": "Online wholesale apparel catalog and direct ordering",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  },
  {
    "Business Name": "Gents Mart (GM - Tulip 141)",
    "Industry": "Wholesale Menswear & T-Shirts (পাইকারি)",
    "District / Location": "Rose Marinas Market, Siddique Bazar, Gulistan, Dhaka, Bangladesh",
    "Public Business Phone": "01814-545840",
    "Official Website": "",
    "Facebook Page URL": "https://www.facebook.com/gentsmartbd/",
    "Source URL": "https://www.facebook.com/",
    "Marketing Opportunity": "Traditional wholesale cluster shop with digital reseller outreach",
    "Verification Status": "Verified",
    "Collection Date": "2026-10-12",
    "Outreach Status": "New"
  }
];

const headers = [
  "Business Name",
  "Industry",
  "District / Location",
  "Public Business Phone",
  "Official Website",
  "Facebook Page URL",
  "Source URL",
  "Marketing Opportunity",
  "Verification Status",
  "Collection Date",
  "Outreach Status"
];

function escapeCsv(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

const csvRows = [];
csvRows.push(headers.map(escapeCsv).join(','));

for (const lead of leads) {
  const row = headers.map(h => lead[h] || '');
  csvRows.push(row.map(escapeCsv).join(','));
}

const csvContent = csvRows.join('\r\n');
const outputPath = path.join(os.homedir(), 'Documents', 'OpenGrokBot', 'Outputs', 'leads_paikari_tshirt_30.csv');
fs.writeFileSync(outputPath, '\ufeff' + csvContent, 'utf8');

console.log('CSV created at:', outputPath);
console.log('Total leads exported:', leads.length);
