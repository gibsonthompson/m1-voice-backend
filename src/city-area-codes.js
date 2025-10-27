// ============================================
// CITY-TO-AREA-CODE DATABASE - ALL 50 STATES
// ============================================

const cityAreaCodes = {
  // GEORGIA - ATLANTA METRO & SURROUNDING
  'Atlanta': ['404', '678', '470', '943'],
  'Gainesville': ['770', '706', '470'],
  'Alpharetta': ['770', '678', '404'],
  'Roswell': ['770', '678', '404'],
  'Johns Creek': ['770', '678', '404'],
  'Sandy Springs': ['770', '678', '404'],
  'Marietta': ['770', '678', '404'],
  'Smyrna': ['770', '678', '404'],
  'Duluth': ['770', '678', '404'],
  'Lawrenceville': ['770', '678', '404'],
  'Suwanee': ['770', '678', '404'],
  'Cumming': ['770', '678', '404'],
  'Buford': ['770', '678', '404'],
  'Peachtree City': ['770', '678', '404'],
  'Kennesaw': ['770', '678', '404'],
  'Woodstock': ['770', '678', '404'],
  'Canton': ['770', '678'],
  'Decatur': ['404', '678', '470'],
  'East Point': ['404', '678', '470'],
  'College Park': ['404', '678', '470'],
  'Norcross': ['770', '678', '404'],
  'Brookhaven': ['404', '678', '470'],
  'Savannah': ['912'],
  'Augusta': ['706', '762'],
  'Macon': ['478'],
  'Columbus': ['706', '762'],
  'Athens': ['706', '762'],
  'Albany': ['229'],
  'Warner Robins': ['478'],
  'Valdosta': ['229'],
  
  // CALIFORNIA
  'Los Angeles': ['213', '310', '323', '424', '747', '818'],
  'San Diego': ['619', '858'],
  'San Jose': ['408'],
  'San Francisco': ['415', '628'],
  'Fresno': ['559'],
  'Sacramento': ['916'],
  'Long Beach': ['562', '310'],
  'Oakland': ['510'],
  'Bakersfield': ['661'],
  'Anaheim': ['714', '657'],
  'Santa Ana': ['714', '949'],
  'Riverside': ['951'],
  'Stockton': ['209'],
  'Irvine': ['949', '714'],
  
  // Add more cities as needed
};

// ALL 50 STATES + DC
const stateAreaCodes = {
  'AL': ['205', '251', '256', '334', '938'],
  'AK': ['907'],
  'AZ': ['480', '520', '602', '623', '928'],
  'AR': ['479', '501', '870'],
  'CA': ['209', '213', '279', '310', '323', '341', '408', '415', '424', '442', '510', '530', '559', '562', '619', '626', '628', '650', '657', '661', '669', '707', '714', '747', '760', '805', '818', '820', '831', '858', '909', '916', '925', '949', '951'],
  'CO': ['303', '719', '720', '970', '983'],
  'CT': ['203', '475', '860', '959'],
  'DE': ['302'],
  'DC': ['202'],
  'FL': ['239', '305', '321', '352', '386', '407', '561', '645', '656', '689', '727', '754', '772', '786', '813', '850', '863', '904', '941', '954'],
  'GA': ['229', '404', '470', '478', '678', '706', '762', '770', '912', '943'],
  'HI': ['808'],
  'ID': ['208', '986'],
  'IL': ['217', '224', '309', '312', '331', '464', '618', '630', '708', '773', '779', '815', '847', '872'],
  'IN': ['219', '260', '317', '463', '574', '765', '812', '930'],
  'IA': ['319', '515', '563', '641', '712'],
  'KS': ['316', '620', '785', '913'],
  'KY': ['270', '364', '502', '606', '859'],
  'LA': ['225', '318', '337', '504', '985'],
  'ME': ['207'],
  'MD': ['240', '301', '410', '443', '667'],
  'MA': ['339', '351', '413', '508', '617', '774', '781', '857', '978'],
  'MI': ['231', '248', '269', '313', '517', '586', '616', '734', '810', '906', '947', '989'],
  'MN': ['218', '320', '507', '612', '651', '763', '952'],
  'MS': ['228', '601', '662', '769'],
  'MO': ['314', '417', '557', '573', '636', '660', '816', '975'],
  'MT': ['406'],
  'NE': ['308', '402', '531'],
  'NV': ['702', '725', '775'],
  'NH': ['603'],
  'NJ': ['201', '551', '609', '640', '732', '848', '856', '862', '908', '973'],
  'NM': ['505', '575'],
  'NY': ['212', '315', '332', '347', '516', '518', '585', '607', '631', '646', '680', '716', '718', '838', '845', '914', '917', '929', '934'],
  'NC': ['252', '336', '704', '743', '828', '910', '919', '980', '984'],
  'ND': ['701'],
  'OH': ['216', '220', '234', '283', '330', '380', '419', '440', '513', '567', '614', '740', '937'],
  'OK': ['405', '539', '572', '918'],
  'OR': ['458', '503', '541', '971'],
  'PA': ['215', '223', '267', '272', '412', '445', '484', '570', '610', '717', '724', '814', '878'],
  'RI': ['401'],
  'SC': ['803', '839', '843', '854', '864'],
  'SD': ['605'],
  'TN': ['423', '615', '629', '731', '865', '901', '931'],
  'TX': ['210', '214', '254', '281', '325', '346', '361', '409', '430', '432', '469', '512', '682', '713', '726', '737', '806', '817', '830', '832', '903', '915', '936', '940', '945', '956', '972', '979'],
  'UT': ['385', '435', '801'],
  'VT': ['802'],
  'VA': ['276', '434', '540', '571', '703', '757', '804'],
  'WA': ['206', '253', '360', '425', '509', '564'],
  'WV': ['304', '681'],
  'WI': ['262', '414', '534', '608', '715', '920'],
  'WY': ['307'],
};

const stateNameToAbbr = {
  'ALABAMA': 'AL',
  'ALASKA': 'AK',
  'ARIZONA': 'AZ',
  'ARKANSAS': 'AR',
  'CALIFORNIA': 'CA',
  'COLORADO': 'CO',
  'CONNECTICUT': 'CT',
  'DELAWARE': 'DE',
  'DISTRICT OF COLUMBIA': 'DC',
  'FLORIDA': 'FL',
  'GEORGIA': 'GA',
  'HAWAII': 'HI',
  'IDAHO': 'ID',
  'ILLINOIS': 'IL',
  'INDIANA': 'IN',
  'IOWA': 'IA',
  'KANSAS': 'KS',
  'KENTUCKY': 'KY',
  'LOUISIANA': 'LA',
  'MAINE': 'ME',
  'MARYLAND': 'MD',
  'MASSACHUSETTS': 'MA',
  'MICHIGAN': 'MI',
  'MINNESOTA': 'MN',
  'MISSISSIPPI': 'MS',
  'MISSOURI': 'MO',
  'MONTANA': 'MT',
  'NEBRASKA': 'NE',
  'NEVADA': 'NV',
  'NEW HAMPSHIRE': 'NH',
  'NEW JERSEY': 'NJ',
  'NEW MEXICO': 'NM',
  'NEW YORK': 'NY',
  'NORTH CAROLINA': 'NC',
  'NORTH DAKOTA': 'ND',
  'OHIO': 'OH',
  'OKLAHOMA': 'OK',
  'OREGON': 'OR',
  'PENNSYLVANIA': 'PA',
  'RHODE ISLAND': 'RI',
  'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD',
  'TENNESSEE': 'TN',
  'TEXAS': 'TX',
  'UTAH': 'UT',
  'VERMONT': 'VT',
  'VIRGINIA': 'VA',
  'WASHINGTON': 'WA',
  'WEST VIRGINIA': 'WV',
  'WISCONSIN': 'WI',
  'WYOMING': 'WY',
};

function normalizeState(state) {
  if (!state) return null;
  const stateUpper = state.trim().toUpperCase();
  if (stateUpper.length === 2) return stateUpper;
  return stateNameToAbbr[stateUpper] || stateUpper;
}

function getAreaCodesForCity(city, state) {
  if (!city || !state) return [];
  
  const normalizedState = normalizeState(state);
  const normalizedCity = city.trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  if (cityAreaCodes[normalizedCity]) {
    return cityAreaCodes[normalizedCity];
  }
  
  if (stateAreaCodes[normalizedState]) {
    return stateAreaCodes[normalizedState];
  }
  
  return [];
}

module.exports = {
  getAreaCodesForCity,
};