/**
 * Techmaax's real branch network — sourced from techmaax.com/branches.html.
 * This is the master list seeded for every fresh environment; edit here to
 * add/rename/close a branch rather than editing the database by hand.
 */
export interface BranchSeed {
  name: string;
  code: string;
  address: string;
  phone: string;
}

export const branchSeeds: BranchSeed[] = [
  // Chennai
  { name: "Anna Nagar", code: "ANR", address: "Q99, SLV Towers, Anna Nagar, Chennai – 600040", phone: "+91 98842 33258" },
  { name: "Ashok Nagar", code: "ASN", address: "No. 4, 9th Avenue, Ashok Nagar, Chennai – 600083", phone: "+91 98846 33258" },
  { name: "Porur", code: "POR", address: "No. 12, Thiruvalluvar St, Trunk Road, Porur, Chennai – 600116", phone: "+91 98846 33258" },
  { name: "Mylapore", code: "MYL", address: "No. 76, North Mada Street, Mylapore, Chennai – 600004", phone: "+91 78258 29283" },
  { name: "Nungambakkam", code: "NGK", address: "13/7, Rosy Tower, Nungambakkam, Chennai – 600034", phone: "+91 98846 27258" },
  { name: "Purasaiwakkam", code: "PSW", address: "No. 94, Prince Towers, Purasawalkam, Chennai – 600010", phone: "+91 89258 85648" },
  { name: "Avadi", code: "AVD", address: "No. 261, Chennai-Thiruvalur High Road, Avadi, Chennai – 600054", phone: "+91 89258 85650" },
  { name: "Ambattur", code: "AMB", address: "125-B, Vivek Nagar, Ambattur, Chennai – 600053", phone: "+91 98842 82258" },
  { name: "Tambaram", code: "TBM", address: "No. 77/243, GST Road, Tambaram, Chennai – 600045", phone: "+91 96000 10186" },
  { name: "Velachery", code: "VLC", address: "No. 10, 6th Main Road, Ram Nagar, Velachery, Chennai – 600042", phone: "+91 98846 93258" },
  { name: "Thoraipakkam", code: "THP", address: "No. 3/330, Rajiv Gandhi Salai, Thoraipakkam, Chennai – 600097", phone: "+91 78258 29282" },
  { name: "Thiruvanmiyur", code: "TVM", address: "No. 34, Valmiki Street, Thiruvanmiyur, Chennai – 600041", phone: "+91 89258 85653" },
  { name: "Kelambakkam", code: "KLB", address: "No. 1/196, Kelambakkam-Kovalam Road, Chennai – 603103", phone: "+91 89258 38972" },
  { name: "Guduvanchery", code: "GDV", address: "No. 84, GST Road, Guduvancheri, Chennai – 603202", phone: "+91 89258 38974" },
  { name: "Chengalpattu", code: "CGP", address: "113A, GST Road, Anna Nagar, Chengalpattu – 603001", phone: "+91 89258 85647" },
  { name: "Sholinganallur", code: "SHL", address: "No. 147, Elcot SEZ, OMR Rajiv Gandhi Road, Chennai – 600096", phone: "+91 89258 85651" },

  // Coimbatore
  { name: "RS Puram", code: "RSP", address: "No. 179, Subveena Towers, RS Puram, Coimbatore – 641002", phone: "+91 89258 85651" },
  { name: "Peelamedu", code: "PLM", address: "No. 58A, Sakthi Nivas, Sri Nagar, Peelamedu, Coimbatore – 641004", phone: "+91 89258 85652" },

  // Trichy
  { name: "Thillai Nagar", code: "TRY", address: "No. 1/24, 3rd Cross Road, Thillai Nagar East, Trichy – 620018", phone: "+91 98842 82258" },

  // Pondicherry
  { name: "Reddiyarpalayam", code: "PDY", address: "27, Villianur Road, Reddiarpalayam, Pondicherry – 605005", phone: "+91 78258 29280" },

  // Bangalore
  { name: "Marathahalli", code: "BLR", address: "Marathahalli, Bangalore, Karnataka", phone: "+91 98842 33258" },
];
