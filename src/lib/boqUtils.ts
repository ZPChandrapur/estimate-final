export interface BOQTemplateRow {
  'Sl. No.': string | number;
  'Item Description': string;
  'Quantity': number;
  'Units': string;
  'Estimated Rate': number;
  'TOTAL AMOUNT Without Taxes': number;
  'TOTAL AMOUNT With Taxes': number;
  'TOTAL AMOUNT In Words': string;
}

export interface BOQItemData {
  slNo: number;
  subworkName?: string;
  itemNumber: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amountWithoutTaxes: number;
  amountWithTaxes: number;
  amountInWords: string;
}

export function numberToWords(num: number): string {
  if (num === 0) return 'Zero Only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  function convertLessThanThousand(n: number): string {
    if (n === 0) return '';

    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');

    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' & ' + convertLessThanThousand(n % 100) : '');
  }

  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const remainder = Math.floor(num % 1000);

  let result = '';

  if (crore > 0) result += convertLessThanThousand(crore) + ' Crore ';
  if (lakh > 0) result += convertLessThanThousand(lakh) + ' Lakh ';
  if (thousand > 0) result += convertLessThanThousand(thousand) + ' Thousand ';
  if (remainder > 0) result += convertLessThanThousand(remainder);

  return 'INR ' + result.trim() + ' Only';
}

export function formatBOQDescription(subworkName: string | undefined, itemDescription: string): string {
  if (!subworkName) return itemDescription;

  if (itemDescription.includes(subworkName)) {
    return itemDescription;
  }

  return `${subworkName}\n${itemDescription}`;
}

export function parseDescriptionForSubwork(description: string): { subwork: string; item: string } | null {
  const subworkMatch = description.match(/^(.+?)\n(.+)$/s);
  if (subworkMatch) {
    return {
      subwork: subworkMatch[1].trim(),
      item: subworkMatch[2].trim()
    };
  }
  return null;
}

export function createBOQTemplateData(): BOQTemplateRow[] {
  return [
    {
      'Sl. No.': '1',
      'Item Description': 'SUB WORK NO. 1 :- SAMPLE SUBWORK NAME\nItem No.1: Sample item description for construction work including all materials, labor, and equipment as per specifications',
      'Quantity': 100.00,
      'Units': 'Cum',
      'Estimated Rate': 500.00,
      'TOTAL AMOUNT Without Taxes': 50000.00,
      'TOTAL AMOUNT With Taxes': 55000.00,
      'TOTAL AMOUNT In Words': 'INR Fifty Five Thousand Only'
    },
    {
      'Sl. No.': '2',
      'Item Description': 'Item No.2: Another sample item description with detailed specifications',
      'Quantity': 50.00,
      'Units': 'Sqm',
      'Estimated Rate': 750.00,
      'TOTAL AMOUNT Without Taxes': 37500.00,
      'TOTAL AMOUNT With Taxes': 41250.00,
      'TOTAL AMOUNT In Words': 'INR Forty One Thousand Two Hundred & Fifty Only'
    },
    {
      'Sl. No.': '3',
      'Item Description': 'SUB WORK NO. 2 :- ANOTHER SAMPLE SUBWORK\nItem No.1: Sample item for second subwork with complete specifications and requirements',
      'Quantity': 25.00,
      'Units': 'No.',
      'Estimated Rate': 2000.00,
      'TOTAL AMOUNT Without Taxes': 50000.00,
      'TOTAL AMOUNT With Taxes': 55000.00,
      'TOTAL AMOUNT In Words': 'INR Fifty Five Thousand Only'
    }
  ];
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}
