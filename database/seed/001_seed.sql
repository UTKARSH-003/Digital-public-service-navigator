-- Seed data: categories + a SMALL set of DEMONSTRATION services.
-- Every service is marked verification_status = 'demonstration'. None has been verified against
-- live official sources. Eligibility rules, documents and steps are illustrative examples and
-- MUST be reviewed by a content reviewer (admin workflow) before being marked 'verified'.
-- Source URLs are limited to official root domains; deep links are intentionally left empty.

insert into public.service_categories (slug, name_en, name_hi, description_en, icon, sort_order) values
 ('identity-documents','Identity and essential documents','पहचान और आवश्यक दस्तावेज','Identity proofs and essential documents','id-card',1),
 ('education-scholarships','Education and scholarships','शिक्षा और छात्रवृत्ति','Scholarships and education support','graduation-cap',2),
 ('employment-skills','Employment and skill development','रोजगार और कौशल विकास','Jobs and skill training','briefcase',3),
 ('healthcare-welfare','Healthcare and welfare','स्वास्थ्य और कल्याण','Health coverage and welfare services','heart-pulse',4),
 ('agriculture','Agriculture and farming','कृषि और खेती','Support for farmers','sprout',5),
 ('women-child','Women and child welfare','महिला एवं बाल कल्याण','Programs for women and children','baby',6),
 ('pension-senior','Pension and senior citizen services','पेंशन और वरिष्ठ नागरिक सेवाएं','Pensions and senior citizen support','hand-heart',7),
 ('business-entrepreneurship','Business registration and entrepreneurship','व्यवसाय पंजीकरण और उद्यमिता','Registrations and business support','store',8),
 ('taxation-finance','Taxation and financial assistance','कराधान और वित्तीय सहायता','Tax services and financial assistance','landmark',9),
 ('housing-utilities','Housing and public utilities','आवास और सार्वजनिक सुविधाएं','Housing schemes and utilities','home',10),
 ('certificates-state','Certificates and state-level services','प्रमाणपत्र और राज्य स्तरीय सेवाएं','Income, caste, domicile and other certificates','file-badge',11),
 ('disability-accessibility','Disability benefits and accessibility services','दिव्यांगजन लाभ और सुलभता सेवाएं','Benefits for persons with disabilities','accessibility',12);

-- Demonstration services (central). Descriptions are generic and unverified.
with c as (select slug, id from public.service_categories)
insert into public.government_services
  (slug, name, short_description, category_id, government_level, target_beneficiaries, tags, status, verification_status, application_url)
values
 ('demo-post-matric-scholarship','Post-matric scholarship (demonstration record)',
  'Illustrative record for a scholarship aimed at students beyond Class 10. Details are unverified; confirm on the official portal.',
  (select id from c where slug='education-scholarships'),'central',
  array['students'], array['scholarship','student','education','fees'],'published','demonstration', null),
 ('demo-farmer-income-support','Farmer income support (demonstration record)',
  'Illustrative record for a direct income support scheme for farming families. Details are unverified; confirm on the official portal.',
  (select id from c where slug='agriculture'),'central',
  array['farmers'], array['farmer','agriculture','income support','kisan'],'published','demonstration', null),
 ('demo-income-certificate','Income certificate (demonstration record)',
  'Illustrative record for obtaining an income certificate. Issuing authority and process vary by state; confirm with your state portal.',
  (select id from c where slug='certificates-state'),'central',
  array['all citizens'], array['certificate','income','document'],'published','demonstration', null),
 ('demo-old-age-pension','Old age pension (demonstration record)',
  'Illustrative record for a social pension for senior citizens. Rules differ across states; confirm on the official portal.',
  (select id from c where slug='pension-senior'),'central',
  array['senior citizens'], array['pension','senior citizen','old age'],'published','demonstration', null),
 ('demo-skill-training','Skill training programme (demonstration record)',
  'Illustrative record for short-term skill training for job seekers. Details are unverified; confirm on the official portal.',
  (select id from c where slug='employment-skills'),'central',
  array['job seekers','youth'], array['skill','training','job','youth'],'published','demonstration', null),
 ('demo-msme-registration','Small business registration (demonstration record)',
  'Illustrative record for registering a micro or small enterprise. Details are unverified; confirm on the official portal.',
  (select id from c where slug='business-entrepreneurship'),'central',
  array['entrepreneurs'], array['business','msme','registration','entrepreneur'],'published','demonstration', null);

-- Official sources: root portals only (never deep links we have not verified)
insert into public.official_sources (service_id, title, url, is_primary)
select s.id, v.title, v.url, true
from public.government_services s
join (values
  ('demo-post-matric-scholarship','National Scholarship Portal','https://scholarships.gov.in/'),
  ('demo-farmer-income-support','myScheme (scheme search)','https://www.myscheme.gov.in/'),
  ('demo-income-certificate','National Portal of India: services','https://services.india.gov.in/'),
  ('demo-old-age-pension','myScheme (scheme search)','https://www.myscheme.gov.in/'),
  ('demo-skill-training','myScheme (scheme search)','https://www.myscheme.gov.in/'),
  ('demo-msme-registration','National Portal of India','https://www.india.gov.in/')
) as v(slug,title,url) on v.slug = s.slug;

-- Illustrative eligibility rules (demonstration only)
insert into public.eligibility_rules (service_id, field, operator, value, mandatory, question_text, explanation, description, sort_order)
select s.id, r.field, r.operator, r.value::jsonb, r.mandatory, r.q, r.expl, r.descr, r.ord
from public.government_services s
join (values
  ('demo-post-matric-scholarship','occupation','eq','"student"',true,'Are you currently a student?','Scholarships are usually for enrolled students.','Applicant must be a student (illustrative)',1),
  ('demo-post-matric-scholarship','annual_income','lte','250000',true,'What is your family''s approximate annual income (INR)?','Many scholarships have an income ceiling. The real limit must be confirmed on the official portal.','Family income at or below an illustrative ceiling',2),
  ('demo-farmer-income-support','occupation','eq','"farmer"',true,'Are you a farmer?','This scheme type targets farming families.','Applicant must be a farmer (illustrative)',1),
  ('demo-income-certificate','age','gte','18',false,'What is your age?','Minors are usually applied for by a guardian. Informational only.','Adult applicant (informational)',1),
  ('demo-old-age-pension','age','gte','60',true,'What is your age?','Senior citizen pensions commonly start at 60; the real threshold varies.','Age 60 or above (illustrative)',1),
  ('demo-skill-training','age','between','[15,45]',true,'What is your age?','Training programmes often have an age band; confirm the real one.','Age between 15 and 45 (illustrative)',1),
  ('demo-msme-registration','occupation','eq','"entrepreneur"',false,'Do you run or plan to run a business?','Informational: registration is for business owners.','Business owner or planner (informational)',1)
) as r(slug,field,operator,value,mandatory,q,expl,descr,ord) on r.slug = s.slug;

-- Illustrative documents
insert into public.required_documents (service_id, name, notes, is_mandatory, sort_order)
select s.id, d.name, d.notes, d.mandatory, d.ord
from public.government_services s
join (values
  ('demo-post-matric-scholarship','Proof of enrolment','Bonafide certificate or ID card from institution',true,1),
  ('demo-post-matric-scholarship','Income certificate','From the competent authority in your state',true,2),
  ('demo-post-matric-scholarship','Bank account details','Account in the applicant''s name',true,3),
  ('demo-farmer-income-support','Land ownership record','As issued by your state revenue department',true,1),
  ('demo-farmer-income-support','Bank account details','Account in the applicant''s name',true,2),
  ('demo-income-certificate','Proof of address','Any government-recognised address proof',true,1),
  ('demo-income-certificate','Income declaration','Self-declaration or supporting income proof',true,2),
  ('demo-old-age-pension','Age proof','Any government-recognised age proof',true,1),
  ('demo-old-age-pension','Bank account details','Account in the applicant''s name',true,2),
  ('demo-skill-training','Photo ID','Any government-recognised photo ID',true,1),
  ('demo-skill-training','Education certificates','Highest qualification, if any',false,2),
  ('demo-msme-registration','Business details','Name, address, activity and start date',true,1),
  ('demo-msme-registration','Bank account details','Business or proprietor account',true,2)
) as d(slug,name,notes,mandatory,ord) on d.slug = s.slug;

-- Generic application steps (identical, non-specific guidance; to be replaced on verification)
insert into public.application_steps (service_id, step_number, title, details)
select s.id, st.n, st.title, st.details
from public.government_services s
cross join (values
  (1,'Open the official portal','Use the official source link shown on this page, not links from messages or ads.'),
  (2,'Confirm eligibility','Read the official eligibility criteria and compare them with your situation.'),
  (3,'Prepare documents','Gather the documents listed on this page and check them against the official list.'),
  (4,'Apply on the official portal','Fill in the application as per the official instructions. Never share OTPs or passwords with anyone.'),
  (5,'Keep your reference number','Note your application reference number to follow up with the department.')
) as st(n,title,details);

-- No Hindi service translations are seeded: none have been written or reviewed yet.
-- The UI falls back to English and shows "translation not available" for service content.
-- Add translations via the admin editor; they default to 'machine_generated' / 'awaiting_review'.
