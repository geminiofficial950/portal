// Demo learning content for CHC33021 Certificate III in Individual Support (Ageing & Disability).
// One entry per unit: overview, key-point notes, quiz, theory, role play, workplace task.

const q = (text, options, answer) => ({ text, options, answer });
const t = (text, guidance, wordLimit) => ({ text, guidance, wordLimit });

export const UNITS = {
  CHCCCS031: {
    about: "how to plan, give and check support that fits each person’s own care plan, goals and preferences",
    learn: ["Read and follow an individualised support plan", "Respect the person’s choices, privacy and dignity", "Provide daily-living support safely", "Report changes and record what you did"],
    notes: ["A support plan describes the person’s goals, needs, routines and risks.", "Always ask for consent before starting any support.", "Encourage the person to do as much as they can for themselves.", "Report changes in health, mood or behaviour to your supervisor straight away.", "Write clear, factual, timely notes after each shift."],
    quiz: [
      q("What should you do before helping someone shower?", ["Start quickly to save time", "Explain what you will do and ask for consent", "Ask a family member instead", "Follow your own routine"], 1),
      q("Where do you find a person’s goals and preferences?", ["Their individualised support plan", "The staff roster", "The fire evacuation plan", "The visitors’ book"], 0),
      q("You notice a client is much more confused than usual. What do you do?", ["Ignore it until next week", "Tell the client to rest", "Report it to your supervisor and record it", "Post about it on social media"], 2),
      q("Which is the best way to support independence?", ["Do every task for the person", "Let the person do what they can and help with the rest", "Rush the person so tasks are done faster", "Only help when family is present"], 1),
    ],
    theory: [
      t("What is person-centred support? Give one example from aged care or disability work.", "Explain the idea in your own words, then describe a real or realistic situation.", 200),
      t("List three things you must record after providing personal care and explain why each matters.", "Think about legal, safety and communication reasons.", 200),
    ],
    rolePlay: {
      scenario: "Mrs Rosa Bianchi, 84, lives in residential care. Her care plan says she likes to shower in the evening, but today a new staff member wants to shower her at 7 am. She is upset and says no.",
      instructions: "Act as the support worker. Talk with Mrs Bianchi, respect her choice, check her care plan and agree on what happens next.",
      criteria: ["Introduces self and explains purpose calmly", "Listens to and respects the person’s choice", "Refers to the support plan before acting", "Explains how the change will be reported"],
    },
    workplace: {
      task: "During placement, provide personal care to two different people, following each person’s individualised support plan. Before each task ask for consent and afterwards complete the progress notes.",
      evidence: ["Completed progress notes for both people (names removed)", "Signed placement observation checklist", "Short reflection (half a page) on what went well"],
    },
  },
  CHCCCS040: {
    about: "how to support people to stay as independent as possible and look after their physical, social and emotional wellbeing",
    learn: ["Recognise what wellbeing means for each person", "Support independence in daily activities", "Use aids and equipment safely", "Notice and respond to signs of poor wellbeing"],
    notes: ["Wellbeing includes physical, emotional, social, cultural and spiritual health.", "Independence builds confidence and dignity.", "Use the person’s strengths, not just their limits.", "Encourage social contact and meaningful activity.", "Report signs of loneliness, low mood or weight loss."],
    quiz: [
      q("Which of these is part of emotional wellbeing?", ["Blood pressure", "Feeling valued and safe", "Shoe size", "Room temperature"], 1),
      q("A client can butter their own toast slowly. What should you do?", ["Do it for them to save time", "Encourage them and allow extra time", "Skip breakfast", "Ask the cook to do it"], 1),
      q("Which is a sign someone may be socially isolated?", ["Chatting at lunch every day", "Stopping all activities they used to enjoy", "Calling family weekly", "Joining a walking group"], 1),
      q("Who should decide on a person’s daily activities?", ["The person, with support", "Only the manager", "Only the doctor", "Whoever is on shift"], 0),
    ],
    theory: [
      t("Describe three areas of wellbeing and one way you could support each.", "Choose from physical, emotional, social, cultural and spiritual.", 250),
      t("Why does supporting independence matter to a person’s self-esteem?", "", 150),
    ],
    rolePlay: {
      scenario: "Mr Tom Nguyen, 70, had a stroke and now uses a walking frame. He wants to make his own cup of tea, but his daughter has asked staff to always do it for him.",
      instructions: "As the support worker, talk with Mr Nguyen about what he wants and how he could do it safely.",
      criteria: ["Asks what the person wants to do", "Suggests safe ways to stay independent", "Respects the person’s right to choose", "Explains that the conversation will be shared with the team"],
    },
    workplace: {
      task: "Identify one person you support and plan one activity that increases their independence. Carry it out with your supervisor’s agreement and record the outcome.",
      evidence: ["Activity plan", "Notes on how the activity went", "Supervisor sign-off sheet"],
    },
  },
  CHCCOM005: {
    about: "how to communicate clearly and respectfully with clients, families and co-workers, and how to work as part of a team",
    learn: ["Use verbal and non-verbal communication", "Adapt communication for hearing, vision or language needs", "Follow reporting lines and workplace procedures", "Keep information confidential"],
    notes: ["Use plain language and check understanding.", "Body language, tone and eye contact matter as much as words.", "Use interpreters, not family members, for important information.", "Follow the chain of command when reporting issues.", "Only share personal information with people who need to know."],
    quiz: [
      q("A client is hard of hearing. What helps most?", ["Shouting from across the room", "Facing them and speaking clearly", "Writing nothing down", "Talking while walking away"], 1),
      q("Who should you report a concern about a client to first?", ["Your supervisor", "Another client", "The newspaper", "Your friends"], 0),
      q("What is confidentiality?", ["Telling everyone about a client", "Only sharing information with people who need it for care", "Never writing notes", "Asking clients personal questions"], 1),
      q("Which is an example of non-verbal communication?", ["A phone call", "Nodding and smiling", "A written report", "An email"], 1),
    ],
    theory: [
      t("Explain three barriers to communication and how you would overcome each.", "Think about language, hearing, noise, emotions and culture.", 250),
      t("Why is it important to follow reporting lines in a care organisation?", "", 150),
    ],
    rolePlay: {
      scenario: "Mrs Leila Haddad’s son phones and asks you for details about his mother’s medication. You don’t know if he is listed as an authorised contact.",
      instructions: "Answer the call as the support worker. Respond politely while protecting the client’s privacy.",
      criteria: ["Greets the caller professionally", "Does not share private information without checking consent", "Explains who can help and how", "Records and reports the call"],
    },
    workplace: {
      task: "Attend one team meeting or shift handover during placement. Contribute at least one update about a client and record what you reported.",
      evidence: ["Your handover notes (names removed)", "Supervisor confirmation of attendance"],
    },
  },
  CHCDIV001: {
    about: "how to work respectfully with people of different cultures, backgrounds, abilities, genders, sexualities and beliefs",
    learn: ["Recognise your own values and biases", "Respect diversity and inclusion", "Communicate across cultures", "Support Aboriginal and Torres Strait Islander people respectfully"],
    notes: ["Diversity includes culture, language, religion, ability, gender, sexuality and age.", "Everyone has unconscious bias — notice yours and don’t let it affect care.", "Ask people how they prefer to be supported; don’t assume.", "Respect cultural practices around food, hygiene, death and family.", "Discrimination is unlawful and must be reported."],
    quiz: [
      q("What is unconscious bias?", ["A legal document", "Attitudes we hold without realising", "A type of medication", "A cultural festival"], 1),
      q("A client fasts during Ramadan. What should you do?", ["Insist they eat at normal times", "Respect their choice and adjust meal times if safe", "Tell their family to stop it", "Ignore their wishes"], 1),
      q("Which of these is discrimination?", ["Offering an interpreter", "Refusing a service because of someone’s religion", "Asking about food preferences", "Using a person’s chosen name"], 1),
      q("The best way to learn about someone’s culture is to:", ["Guess from their name", "Ask them respectfully", "Read one website", "Ask another worker"], 1),
    ],
    theory: [
      t("Describe one way your own background could influence how you see others, and how you manage this at work.", "", 200),
      t("What does culturally safe care mean for Aboriginal and Torres Strait Islander people?", "Mention respect, listening and community.", 200),
    ],
    rolePlay: {
      scenario: "Mr Ahmed Khan has just moved into care. He speaks limited English and prays five times a day. A co-worker complains that his prayer times get in the way of the shift routine.",
      instructions: "Speak with your co-worker and suggest how the team can support Mr Khan’s beliefs.",
      criteria: ["Shows respect for the client’s religion", "Suggests practical, inclusive solutions", "Stays professional with the co-worker", "Knows when to escalate discrimination"],
    },
    workplace: {
      task: "Find out about the cultural or personal preferences of one person you support (with their consent) and show how you adapted your support.",
      evidence: ["Short written summary of the preferences", "Example of how support was adapted", "Supervisor sign-off"],
    },
  },
  CHCLEG001: {
    about: "the laws, rights and ethical rules that guide community services work, including duty of care, privacy and mandatory reporting",
    learn: ["Understand duty of care", "Respect privacy and confidentiality laws", "Recognise and report abuse or neglect", "Follow codes of conduct and work within your role"],
    notes: ["Duty of care means taking reasonable steps to keep people safe from harm.", "Dignity of risk: people have the right to take reasonable risks.", "Privacy laws control how personal information is collected and shared.", "Suspected abuse must be reported following your organisation’s policy.", "Only do tasks you are trained and allowed to do."],
    quiz: [
      q("What is duty of care?", ["Doing whatever the client says", "Taking reasonable care to avoid harm", "Working overtime", "Paying for client outings"], 1),
      q("You suspect a client is being financially abused by a relative. You should:", ["Confront the relative", "Report it following organisational policy", "Wait for more proof for months", "Tell other clients"], 1),
      q("What does ‘dignity of risk’ mean?", ["Clients cannot take any risks", "People can choose to take reasonable risks", "Workers take all risks", "Risk forms are optional"], 1),
      q("A client asks you to give them a medication you are not trained to give. You:", ["Give it anyway", "Explain you can’t and get a qualified person", "Ask another client", "Ignore the request"], 1),
    ],
    theory: [
      t("Explain the difference between duty of care and dignity of risk using an example.", "", 250),
      t("What should you do if you think a client is being abused? List the steps.", "Think about safety, reporting and recording.", 200),
    ],
    rolePlay: {
      scenario: "A client, Mr Jack Wilson, tells you in confidence that another staff member shouted at him and grabbed his arm. He asks you not to tell anyone.",
      instructions: "Respond to Mr Wilson, explain what you must do and why.",
      criteria: ["Listens calmly and believes the client", "Explains honestly that it must be reported", "Reassures the client about his safety", "Describes the correct reporting steps"],
    },
    workplace: {
      task: "Read your placement organisation’s code of conduct and privacy policy. Identify three rules you follow every shift and show where you applied them.",
      evidence: ["Summary of three rules and how you applied them", "Supervisor sign-off"],
    },
  },
  CHCCCS041: {
    about: "the basic structure and function of the main body systems and how to recognise healthy functioning and changes",
    learn: ["Name the main body systems and what they do", "Recognise normal and abnormal signs", "Support healthy eating, movement and sleep", "Report changes in a person’s health"],
    notes: ["Main systems: cardiovascular, respiratory, digestive, musculoskeletal, nervous, urinary, skin and endocrine.", "Ageing affects every system — e.g. skin becomes thinner, bones weaker.", "Watch for changes in breathing, skin colour, appetite, toileting and mobility.", "Fluids and good nutrition support every body system.", "Report changes early — small changes can be serious."],
    quiz: [
      q("Which system moves blood around the body?", ["Digestive", "Cardiovascular", "Urinary", "Skeletal"], 1),
      q("Which body system includes the lungs?", ["Respiratory", "Nervous", "Endocrine", "Digestive"], 0),
      q("Thin, easily damaged skin in older people increases the risk of:", ["Hair growth", "Skin tears and pressure injuries", "Better circulation", "Stronger nails"], 1),
      q("A client has not passed urine all day. You should:", ["Wait until tomorrow", "Report it to your supervisor straight away", "Give them coffee", "Ignore it"], 1),
    ],
    theory: [
      t("Choose two body systems. Describe what each does and one common change that happens with ageing.", "", 250),
      t("List four signs that a person’s health may be getting worse and what you would do.", "", 200),
    ],
    rolePlay: {
      scenario: "During morning care, you notice Mrs Joan Smith is breathing faster than usual, looks pale and says she feels tired.",
      instructions: "Show how you would respond, reassure Mrs Smith and report what you observed.",
      criteria: ["Notices and names the changes", "Stays calm and reassures the client", "Reports promptly to the right person", "Records observations accurately"],
    },
    workplace: {
      task: "Observe and record the daily routines of one person (meals, fluids, toileting, mobility) over two shifts and note anything unusual you reported.",
      evidence: ["Observation chart for two shifts", "Copy of any report made (names removed)", "Supervisor sign-off"],
    },
  },
  HLTWHS002: {
    about: "how to keep yourself, clients and co-workers safe while providing direct care, including manual handling and hazard reporting",
    learn: ["Identify hazards in the care environment", "Use safe manual handling and equipment", "Follow emergency procedures", "Look after your own health and stress"],
    notes: ["Hazard → risk → control: spot it, assess it, fix or report it.", "Use hoists, slide sheets and other aids as trained — never lift a person manually.", "Report incidents and near misses straight away.", "Know your emergency exits and assembly area.", "Look after yourself: rest, hydrate and ask for help when stressed."],
    quiz: [
      q("What should you do first when you see a spill on the floor?", ["Walk around it", "Make the area safe and report or clean it", "Leave it for the cleaner", "Ignore it"], 1),
      q("How should you move a client who cannot stand?", ["Lift them on your own", "Use the equipment in their care plan, as trained", "Drag them by the arms", "Ask another client to help"], 1),
      q("A near miss is:", ["An event that could have caused harm but didn’t", "A missed shift", "A late bus", "A type of lifting"], 0),
      q("Who is responsible for safety at work?", ["Only the manager", "Everyone, including you", "Only clients", "Only visitors"], 1),
    ],
    theory: [
      t("Describe three hazards you might find when providing personal care and how to control each.", "", 250),
      t("Why is it important to report near misses?", "", 150),
    ],
    rolePlay: {
      scenario: "You are asked to help transfer Mr Peter Lee from bed to chair. The hoist battery is flat and your co-worker suggests you both just lift him.",
      instructions: "Respond to your co-worker and show what you would do instead.",
      criteria: ["Refuses unsafe manual lifting", "Suggests a safe alternative or waits for equipment", "Keeps the client informed and comfortable", "Reports the equipment fault"],
    },
    workplace: {
      task: "Complete a hazard check of one client area during placement and report any hazards you find using the organisation’s form.",
      evidence: ["Completed hazard checklist", "Copy of the hazard report", "Supervisor sign-off"],
    },
  },
  HLTINF006: {
    about: "the basic principles of infection prevention and control, including hand hygiene, PPE and standard precautions",
    learn: ["Follow standard and transmission-based precautions", "Perform hand hygiene correctly", "Put on and take off PPE in the right order", "Handle waste, linen and spills safely"],
    notes: ["Hand hygiene is the single most important way to stop infection spreading.", "Use the 5 moments of hand hygiene.", "Standard precautions apply to everyone, every time.", "PPE: put on gown, mask, eyewear, gloves; take off gloves first.", "Put sharps in a sharps container — never recap needles."],
    quiz: [
      q("What is the most important way to prevent infection?", ["Wearing perfume", "Hand hygiene", "Opening windows only", "Taking vitamins"], 1),
      q("When should you take off gloves?", ["After you leave the building", "Straight after the task, then clean your hands", "Never", "At the end of the week"], 1),
      q("Standard precautions apply to:", ["Only people with known infections", "Every person, every time", "Only staff", "Only visitors"], 1),
      q("Where should a used needle go?", ["General rubbish bin", "Sharps container", "Recycling bin", "Back in its cap"], 1),
    ],
    theory: [
      t("Explain the chain of infection and one way to break each link.", "", 250),
      t("Describe the correct order for putting on and taking off PPE.", "", 200),
    ],
    rolePlay: {
      scenario: "A client has gastro symptoms (vomiting). You need to clean up and continue caring for them while protecting others.",
      instructions: "Demonstrate (or describe aloud) how you would manage the situation safely.",
      criteria: ["Performs hand hygiene at the right moments", "Uses correct PPE in the correct order", "Cleans the spill using the right procedure", "Reports and documents the situation"],
    },
    workplace: {
      task: "During placement, be observed performing hand hygiene and putting on/taking off PPE correctly at least three times.",
      evidence: ["Signed hand hygiene observation form", "Signed PPE observation form"],
    },
  },
  CHCCCS038: {
    about: "how to empower people to make their own decisions, speak up for themselves and take part in their community",
    learn: ["Support choice and control", "Use a rights-based approach", "Support self-advocacy and advocacy services", "Recognise and reduce power imbalances"],
    notes: ["Empowerment means the person has choice and control over their life.", "Offer real choices and give information in a way the person understands.", "Support people to speak up — or connect them with an advocate.", "Avoid ‘doing for’ when you can ‘do with’.", "Respect decisions even when you would choose differently."],
    quiz: [
      q("What does empowerment mean in care?", ["Workers make all decisions", "The person has choice and control", "Families decide everything", "No one decides"], 1),
      q("A client wants to complain about their service. You should:", ["Discourage them", "Explain how to complain and offer support", "Tell them it won’t help", "Complain for them without asking"], 1),
      q("Which is a good way to offer choice?", ["‘You’re wearing this.’", "‘Would you like the blue or the green shirt?’", "‘Hurry up.’", "‘I’ve already decided.’"], 1),
      q("An advocate is someone who:", ["Supports a person to have their voice heard", "Gives medication", "Cleans rooms", "Writes rosters"], 0),
    ],
    theory: [
      t("Describe two ways you can support a person to make their own decisions.", "", 200),
      t("What could you do if a person’s family is making decisions the person disagrees with?", "", 200),
    ],
    rolePlay: {
      scenario: "Ms Grace Taylor, 45, who has an intellectual disability, wants to join a weekend art class. Her support coordinator thinks it is ‘too much’ for her.",
      instructions: "Support Ms Taylor to explain what she wants and plan the next steps together.",
      criteria: ["Listens to what the person wants", "Gives clear, accessible information", "Supports self-advocacy", "Plans next steps with the person"],
    },
    workplace: {
      task: "Support one person to make a choice about an activity or routine during placement and record how you made sure the decision was theirs.",
      evidence: ["Written record of the decision and how it was supported", "Supervisor sign-off"],
    },
  },
  CHCAGE011: {
    about: "how dementia affects people and how to provide person-centred support that reduces distress and keeps people engaged",
    learn: ["Understand common types and stages of dementia", "Communicate with people living with dementia", "Respond to changed behaviours", "Support meaningful activity and family involvement"],
    notes: ["Dementia is a group of conditions affecting memory, thinking and behaviour.", "Changed behaviours are often a way of communicating an unmet need.", "Use short sentences, one instruction at a time, and a calm tone.", "Life stories and familiar routines help people feel safe.", "Involve families and record what works."],
    quiz: [
      q("Changed behaviour in dementia is often a sign of:", ["Bad manners", "An unmet need such as pain or fear", "Laziness", "Nothing at all"], 1),
      q("Which communication tip helps most?", ["Ask many questions at once", "Use short, simple sentences and give time", "Speak quickly", "Argue to correct them"], 1),
      q("A resident keeps asking for her late husband. A kind response is to:", ["Tell her harshly he died", "Acknowledge her feelings and gently redirect", "Ignore her", "Laugh it off"], 1),
      q("Which helps a person with dementia feel secure?", ["Changing routines daily", "Familiar routines and objects", "Loud environments", "Many new staff"], 1),
    ],
    theory: [
      t("Describe three possible causes of changed behaviour in a person living with dementia.", "Think about pain, environment, emotions and needs.", 250),
      t("How can a life story help you support a person living with dementia?", "", 150),
    ],
    rolePlay: {
      scenario: "Mr Frank O’Brien, who lives with dementia, becomes agitated every afternoon and tries to leave the building saying he must ‘get to work’.",
      instructions: "Respond to Mr O’Brien in a calm, person-centred way.",
      criteria: ["Approaches calmly and at eye level", "Validates feelings instead of arguing", "Redirects to a meaningful activity", "Records the behaviour and what helped"],
    },
    workplace: {
      task: "Support a person living with dementia in a meaningful activity based on their interests and record their response.",
      evidence: ["Activity plan based on life story", "Notes on the person’s response", "Supervisor sign-off"],
    },
  },
  CHCPAL003: {
    about: "how to support people with life-limiting illness, focusing on comfort, dignity and the wishes of the person and their family",
    learn: ["Understand the palliative approach", "Respect advance care plans and wishes", "Support comfort and recognise pain", "Support families and look after yourself"],
    notes: ["The palliative approach focuses on quality of life, not cure.", "Follow the person’s advance care plan and wishes.", "Watch for signs of pain or discomfort and report them.", "Mouth care, positioning and skin care support comfort.", "Grief is normal — use debriefing and support for yourself."],
    quiz: [
      q("The main aim of palliative care is:", ["Curing the illness", "Comfort and quality of life", "Discharging the person", "Reducing staff numbers"], 1),
      q("An advance care plan tells you:", ["The person’s wishes for future care", "The staff roster", "The menu", "Visiting hours only"], 0),
      q("A dying person seems in pain. You should:", ["Wait until the end of shift", "Report it immediately to the nurse", "Give them your own medication", "Ignore it"], 1),
      q("Which helps comfort near the end of life?", ["Regular mouth care and repositioning", "Bright lights all night", "Loud TV", "Rushing care"], 0),
    ],
    theory: [
      t("Explain what a palliative approach is and how it differs from curative care.", "", 200),
      t("Describe two ways you could support a family member who is grieving.", "", 200),
    ],
    rolePlay: {
      scenario: "Mrs Edna Brown is receiving palliative care. Her daughter is upset and asks you, ‘Is she going to die today?’",
      instructions: "Respond to the daughter with empathy while staying within your role.",
      criteria: ["Responds with empathy and listens", "Stays within scope and refers to the nurse", "Offers practical comfort or support", "Respects the person’s privacy and wishes"],
    },
    workplace: {
      task: "Under supervision, assist with comfort care for a person receiving palliative care (or a simulated case if not available) and reflect on the experience.",
      evidence: ["Record of comfort care provided", "Reflection (half a page)", "Supervisor sign-off"],
    },
  },
  CHCAGE013: {
    about: "how the aged care system works and how to provide respectful, high-quality support that meets the Aged Care Quality Standards",
    learn: ["Understand the aged care service system", "Apply the Aged Care Quality Standards", "Recognise ageism and promote positive ageing", "Support older people’s rights"],
    notes: ["Older people have the same rights as everyone else.", "The Aged Care Quality Standards set out what good care looks like.", "Ageism means stereotyping or discriminating because of age.", "Support people to stay connected with family and community.", "Feedback and complaints help services improve."],
    quiz: [
      q("Ageism means:", ["Respecting older people", "Stereotyping or discriminating because of age", "Counting birthdays", "A type of exercise"], 1),
      q("The Aged Care Quality Standards describe:", ["What good aged care looks like", "Staff pay rates", "Building colours", "Holiday dates"], 0),
      q("An older person wants to keep managing their own money. You should:", ["Take over for safety", "Respect their right and support if asked", "Tell their family to decide", "Hide their bank card"], 1),
      q("Which is an example of positive ageing?", ["Staying active and socially connected", "Avoiding all activities", "Being told what to do", "Staying in bed all day"], 0),
    ],
    theory: [
      t("Describe two common myths about older people and why they are wrong.", "", 200),
      t("How does your daily work help a service meet the Aged Care Quality Standards?", "", 200),
    ],
    rolePlay: {
      scenario: "A new staff member calls residents ‘sweetie’ and speaks to them like children. A resident, Mrs Mary Clarke, looks embarrassed.",
      instructions: "Show how you would support Mrs Clarke and speak to your co-worker.",
      criteria: ["Uses the resident’s preferred name respectfully", "Addresses ageist language professionally", "Supports the resident’s dignity", "Knows when to report to a supervisor"],
    },
    workplace: {
      task: "Identify how your placement service meets one Aged Care Quality Standard and give one example from your own practice.",
      evidence: ["Short written example (half a page)", "Supervisor sign-off"],
    },
  },
  CHCDIS011: {
    about: "how to help people with disability build and keep skills using a strengths-based approach",
    learn: ["Identify a person’s strengths and goals", "Support skill development step by step", "Give encouragement and feedback", "Record and review progress"],
    notes: ["A strengths-based approach focuses on what the person can do.", "Break a skill into small steps and practise often.", "Use prompts, then fade them as the person improves.", "Celebrate progress — however small.", "Record progress so the team can review goals."],
    quiz: [
      q("A strengths-based approach focuses on:", ["What the person cannot do", "What the person can do and wants to achieve", "Only medical needs", "Staff convenience"], 1),
      q("The best way to teach a new skill is to:", ["Do it all at once", "Break it into small steps", "Show it once and leave", "Only explain in writing"], 1),
      q("Why do we fade prompts over time?", ["To build independence", "To save time only", "Because prompts are bad", "To test the client"], 0),
      q("Progress should be:", ["Kept in your head", "Recorded and reviewed with the team", "Shared on social media", "Ignored"], 1),
    ],
    theory: [
      t("Explain the strengths-based approach and give an example of using it.", "", 200),
      t("Describe how you would break down a daily living skill (e.g. making a sandwich) into steps.", "", 200),
    ],
    rolePlay: {
      scenario: "Sam, 28, has an intellectual disability and wants to learn to catch the bus to work on his own.",
      instructions: "Talk with Sam about his goal and plan the first steps together.",
      criteria: ["Identifies Sam’s strengths", "Breaks the goal into small steps", "Agrees how progress will be tracked", "Encourages and gives positive feedback"],
    },
    workplace: {
      task: "Support one person to practise a skill over at least two sessions and record their progress against their goal.",
      evidence: ["Skill plan with steps", "Progress notes from two sessions", "Supervisor sign-off"],
    },
  },
  CHCDIS012: {
    about: "how to support people with disability to take part in community life and build social connections",
    learn: ["Identify community activities that match interests", "Reduce barriers to participation", "Support relationships and belonging", "Respect choice and risk"],
    notes: ["Social inclusion means being part of community life, not just attending.", "Find out the person’s interests first.", "Look for barriers: transport, cost, access, attitudes.", "Support friendships, not just activities.", "Respect the person’s choice to join — or not."],
    quiz: [
      q("Social inclusion means:", ["Staying home every day", "Being part of community life", "Only group outings with staff", "Watching TV"], 1),
      q("The first step in planning an activity is to:", ["Book anything available", "Find out the person’s interests", "Ask the manager’s preference", "Pick the cheapest option"], 1),
      q("Which is a barrier to participation?", ["Accessible transport", "No wheelchair access at the venue", "A friendly coach", "Free entry"], 1),
      q("A person decides not to go to an activity. You should:", ["Make them go", "Respect their choice and ask why", "Report them", "Cancel all future activities"], 1),
    ],
    theory: [
      t("Describe three barriers to community participation and how to reduce each.", "", 250),
      t("Why are friendships and relationships important for wellbeing?", "", 150),
    ],
    rolePlay: {
      scenario: "Lena, who uses a wheelchair, wants to join a local book club, but the meetings are upstairs in a café.",
      instructions: "Work with Lena to find a way for her to take part.",
      criteria: ["Asks about Lena’s wishes", "Identifies the access barrier", "Suggests practical solutions with Lena", "Respects Lena’s final decision"],
    },
    workplace: {
      task: "Support one person to attend a community activity of their choice and record how you reduced barriers.",
      evidence: ["Activity plan", "Notes after the activity", "Supervisor sign-off"],
    },
  },
  CHCDIS020: {
    about: "the disability support system, the NDIS, rights-based practice and how to work effectively as a disability support worker",
    learn: ["Understand the NDIS and support plans", "Apply the NDIS Code of Conduct", "Use a person-centred, rights-based approach", "Work within your role and report incidents"],
    notes: ["The NDIS funds supports based on a person’s goals.", "The NDIS Code of Conduct applies to all workers.", "People with disability have the same rights as everyone else.", "Report incidents, including restrictive practices, as required.", "Work within your role and ask when unsure."],
    quiz: [
      q("What does NDIS stand for?", ["National Disability Insurance Scheme", "National Daily Income Support", "New Disability Information System", "National Doctor Insurance Service"], 0),
      q("Who must follow the NDIS Code of Conduct?", ["Only managers", "All NDIS workers and providers", "Only participants", "Only families"], 1),
      q("A rights-based approach means:", ["Workers decide what is best", "Respecting the person’s human rights and choices", "Following the cheapest option", "Avoiding risk at all costs"], 1),
      q("You see an unauthorised restrictive practice being used. You should:", ["Join in", "Report it as an incident", "Ignore it", "Tell the client to accept it"], 1),
    ],
    theory: [
      t("Explain two parts of the NDIS Code of Conduct and how you apply them.", "", 250),
      t("What is a restrictive practice and why must it be reported?", "", 200),
    ],
    rolePlay: {
      scenario: "A participant, Josh, tells you he wants to change his support worker because he doesn’t feel respected. His mother says he should keep the current worker.",
      instructions: "Support Josh to express his wishes and explain his options.",
      criteria: ["Listens to Josh first", "Explains Josh’s rights and options", "Stays respectful with the family", "Records and passes on the request"],
    },
    workplace: {
      task: "Review the NDIS plan goals of one participant (with consent) and show how one of your shifts supported a goal.",
      evidence: ["Goal summary (names removed)", "Shift notes linking support to the goal", "Supervisor sign-off"],
    },
  },
};
