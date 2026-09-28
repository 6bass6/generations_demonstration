// Month names and date formatting shared by participant and admin pages.
window.MONTHS = ["January", "February", "March", "April", "May", "June", "July",
                 "August", "September", "October", "November", "December"];
window.DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
window.formatDate = (month, day) => `${day} ${MONTHS[month - 1]}`;
