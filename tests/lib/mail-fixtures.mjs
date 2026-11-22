// Thirty made-up emails for the mailbox script's sorting rules (tests/cases/07-mail-script.mjs), each with where it
// should end up. Invented people at example.test addresses; the services' own domains, since those are what the rules
// match. "started" is when setup first ran: the old email is from the day before.
import { SITE_ADDRESS, googleAuth } from './gas.mjs';

const SITE = 'phillyafterschool.org';
const site = (kind, subject, extra = {}) => ({ from: `Philly After School <${SITE_ADDRESS}>`, subject: '[Philly After School] ' + subject, headers: kind ? { 'X-PAS-Kind': kind, 'Auto-Submitted': 'auto-generated' } : { 'Auto-Submitted': 'auto-generated' }, auth: googleAuth(SITE), ...extra });
const svc = (from, domain, subject, extra = {}) => ({ from, subject, auth: googleAuth(domain), ...extra });

export const DAY = 86400000;
export const MAIL_FIXTURES = [
  // The site's own notices, by the header.
  [site('signup', 'New Parent Account Signup: Dana Reyes'), { action: 'notice', label: 'PAS/Site/Sign-ups', inbox: false }],
  [site('suggestion', 'A program that’s missing: Sunny Club (Fell)'), { action: 'notice', label: 'PAS/Site/Suggestions', inbox: false }],
  [site('review', 'Review: Sunny Club (5 stars)'), { action: 'notice', label: 'PAS/Site/Reviews', inbox: true }],
  [site('claim', 'Listing claimed: Sunny Club'), { action: 'notice', label: 'PAS/Site/Claims', inbox: false }],
  [site('needs-yes', 'A claim needs your yes: City Rec Center'), { action: 'notice', label: 'PAS/Site/Needs a yes', inbox: false }],
  [site('manager-content', 'Words to approve: Sunny Club'), { action: 'notice', label: 'PAS/Site/Manager content', inbox: false }],
  [site('school-ask', 'School request: Example Elementary'), { action: 'notice', label: 'PAS/Site/School asks', inbox: false }],
  [site('summary', 'Philly After School this morning: 2 waiting for you'), { action: 'notice', label: 'PAS/Site/Summary', inbox: false }],
  [site('rush', 'Rush: 3 items in the queue'), { action: 'notice', label: 'PAS/Site/Queue', inbox: true }],
  // Older notices, from before the header, by their subjects.
  [site('', 'Listing claimed: Sunny Club'), { action: 'notice', label: 'PAS/Site/Claims', inbox: false }],
  [site('', 'Review: Rae’s Music (4 stars)'), { action: 'notice', label: 'PAS/Site/Reviews', inbox: true }],
  // The contact form: a person's words, answered at the Reply-To address.
  [site('contact', 'Contact: A question (Zoe Park)', { replyTo: 'zoe@example.test', text: 'Topic: A question\nName: Zoe Park\nEmail: zoe@example.test\n\nMessage:\nIs there a program near Fell?' }), { action: 'person', via: 'form' }],
  // Claims to be the site's own and isn't: labeled, left in the inbox for a person.
  [site('signup', 'New Parent Account Signup', { auth: googleAuth(SITE, { dkim: 'fail', spf: 'fail', dmarc: 'fail' }) }), { action: 'suspicious', label: 'PAS/Suspicious', inbox: true }],
  // The site's address writing to itself, not a notice: left alone.
  [{ from: `Owner <${SITE_ADDRESS}>`, subject: 'testing the inbox', auth: googleAuth(SITE) }, { action: 'own', inbox: true }],
  // The services.
  [svc('GitHub <notifications@github.com>', 'github.com', '[shwamansilverbauer/phillyafterschool] Site check: something needs a look (Issue #40)'), { action: 'service', label: 'PAS/Service/GitHub', inbox: true, star: true }],
  [svc('GitHub <notifications@github.com>', 'github.com', 'Re: [shwamansilverbauer/phillyafterschool] Weekly link sweep (PR #41)', { headers: { 'List-Unsubscribe': '<mailto:unsub@github.example>' } }), { action: 'service', label: 'PAS/Service/GitHub', inbox: false }],
  [svc('Stripe <receipts@stripe.com>', 'stripe.com', 'Your receipt from Philly After School'), { action: 'service', label: 'PAS/Service/Stripe', inbox: false }],
  [svc('Stripe <notifications@stripe.com>', 'stripe.com', 'A payment failed for a subscription'), { action: 'service', label: 'PAS/Service/Stripe', inbox: true, star: true }],
  [svc('Postmark <support@postmarkapp.com>', 'postmarkapp.com', 'Spam complaint on your Postmark server'), { action: 'service', label: 'PAS/Service/Postmark', inbox: true, star: true }],
  [svc('UptimeRobot <alert@uptimerobot.com>', 'uptimerobot.com', 'Monitor is DOWN: phillyafterschool.org'), { action: 'service', label: 'PAS/Service/UptimeRobot', inbox: true, star: true }],
  [svc('UptimeRobot <alert@uptimerobot.com>', 'uptimerobot.com', 'Monitor is UP: phillyafterschool.org'), { action: 'service', label: 'PAS/Service/UptimeRobot', inbox: false }],
  [svc('Hostinger <billing@hostinger.com>', 'hostinger.com', 'Your invoice is ready'), { action: 'service', label: 'PAS/Service/Hostinger', inbox: false }],
  [svc('Google <no-reply@accounts.google.com>', 'google.com', 'Security alert', { auth: googleAuth('accounts.google.com') }), { action: 'service', label: 'PAS/Service/Google', inbox: false }],
  // Looks like GitHub but isn't signed by it: a person reads it.
  [{ from: 'GitHub <notifications@github.com>', subject: 'Urgent: your repository will be deleted', auth: googleAuth('github.com', { dkim: 'fail', spf: 'softfail', dmarc: 'fail' }) }, { action: 'person', via: 'mail' }],
  // A newsletter, a bounce, an automatic reply.
  [{ from: 'Rec News <news@rec.example.test>', subject: 'This month at the rec', headers: { 'List-Unsubscribe': '<https://rec.example.test/unsub>' }, auth: googleAuth('rec.example.test') }, { action: 'bulk', label: 'PAS/Newsletters', inbox: false }],
  [{ from: 'Mail Delivery Subsystem <mailer-daemon@googlemail.com>', subject: 'Delivery Status Notification (Failure)', headers: { 'X-Failed-Recipients': 'gone@example.test' }, auth: googleAuth('googlemail.com') }, { action: 'bounce', label: 'PAS/Bounces', inbox: false }],
  [{ from: 'Sam Lee <sam@sunny.example.test>', subject: 'Automatic reply: Your listing on Philly After School', headers: { 'Auto-Submitted': 'auto-replied' }, auth: googleAuth('sunny.example.test') }, { action: 'auto', label: 'PAS/Auto-replies', inbox: false }],
  // People.
  [{ from: 'Rae Kim <rae.kim@gmail.example>', subject: 'Sunny Club hours changed', auth: googleAuth('gmail.example'), text: 'Hi, Sunny Club now runs until 6:30.' }, { action: 'person', via: 'mail' }],
  [{ from: 'Pat Lee <director@sunny.example.test>', subject: 'Re: Your listing', auth: googleAuth('sunny.example.test'), text: 'Our new hours are 3 to 6:30.' }, { action: 'person', via: 'mail' }],
  // From before setup ran: left where it is.
  [{ from: 'Jo Park <jo@example.test>', subject: 'An old question', auth: googleAuth('example.test'), old: true }, { action: 'old', inbox: true }],
];
