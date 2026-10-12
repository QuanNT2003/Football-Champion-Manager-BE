// Name database for 96 countries mapped by country_id
export interface CountryNames {
  firstNames: string[];
  lastNames: string[];
  // If true, FullName = LastName + ' ' + FirstName (e.g. Vietnam, China, Korea, etc.)
  isLastNameFirst?: boolean;
}

export const COUNTRY_NAMES_DB: Record<number, CountryNames> = {
  // 1: France
  1: {
    firstNames: ['Antoine', 'Kylian', 'Hugo', 'Lucas', 'Alexandre', 'Theo', 'Adrien', 'Maxime', 'Julien', 'Clement', 'Mathieu', 'Paul', 'Olivier', 'Raphael', 'Benjamin', 'Kingsley', 'Aurelien', 'Eduardo', 'Ousmane', 'Christopher', 'Moussa', 'Youssouf', 'Brice', 'Nicolas', 'Romain', 'Corentin', 'Tanguy', 'Florian', 'Leo', 'Gabriel'],
    lastNames: ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'Andre', 'Mercier', 'Dupont', 'Lambert', 'Bonnet', 'Francois', 'Legrand', 'Garnier']
  },
  // 2: Spain
  2: {
    firstNames: ['Alvaro', 'Sergio', 'Pablo', 'Marcos', 'Carlos', 'Javier', 'David', 'Alejandro', 'Daniel', 'Lucas', 'Manuel', 'Adrian', 'Ferran', 'Pedri', 'Gavi', 'Rodri', 'Lamine', 'Nico', 'Dani', 'Aymeric', 'Unai', 'Mikel', 'Martin', 'Pau', 'Alex', 'Marc', 'Jorge', 'Inigo', 'Bryan', 'Yeremy'],
    lastNames: ['Garcia', 'Gonzalez', 'Rodriguez', 'Fernandez', 'Lopez', 'Martinez', 'Sanchez', 'Perez', 'Gomez', 'Martin', 'Jimenez', 'Ruiz', 'Hernandez', 'Diaz', 'Moreno', 'Munoz', 'Alvarez', 'Romero', 'Alonso', 'Gutierrez', 'Navarro', 'Torres', 'Dominguez', 'Vazquez', 'Ramos', 'Gil', 'Ramirez', 'Serrano', 'Blanco', 'Molina']
  },
  // 3: England
  3: {
    firstNames: ['Harry', 'Jack', 'Oliver', 'George', 'Charlie', 'James', 'William', 'Thomas', 'Henry', 'Edward', 'Mason', 'Declan', 'Jude', 'Trent', 'Phil', 'Bukayo', 'Marcus', 'Cole', 'Conor', 'Kobbie', 'John', 'Kyle', 'Jordan', 'Luke', 'Kieran', 'Jarrod', 'Eberechi', 'Ollie', 'Ivan', 'Anthony'],
    lastNames: ['Smith', 'Jones', 'Taylor', 'Brown', 'Williams', 'Wilson', 'Johnson', 'Davies', 'Robinson', 'Wright', 'Thompson', 'Evans', 'Walker', 'White', 'Roberts', 'Green', 'Hall', 'Wood', 'Jackson', 'Clarke', 'Kane', 'Bellingham', 'Saka', 'Foden', 'Rice', 'Pickford', 'Palmer', 'Mainoo', 'Stones', 'Alexander-Arnold']
  },
  // 4: Belgium
  4: {
    firstNames: ['Kevin', 'Romelu', 'Eden', 'Thibaut', 'Leandro', 'Youri', 'Jeremy', 'Amadou', 'Arthur', 'Charles', 'Jan', 'Toby', 'Timothy', 'Orel', 'Zeno', 'Johan', 'Dodi', 'Lois', 'Koen', 'Wout'],
    lastNames: ['Peeters', 'Janssens', 'Maes', 'Jacobs', 'Mertens', 'Willems', 'Claes', 'Goossens', 'Wouters', 'De Smet', 'De Bruyne', 'Lukaku', 'Hazard', 'Courtois', 'Trossard', 'Tielemans', 'Doku', 'Onana', 'Theate', 'Castagne']
  },
  // 5: Netherlands
  5: {
    firstNames: ['Virgil', 'Frenkie', 'Memphis', 'Cody', 'Matthijs', 'Nathan', 'Denzel', 'Teun', 'Joey', 'Xavi', 'Bart', 'Stefan', 'Quinten', 'Tijjani', 'Jeremie', 'Wout', 'Steven', 'Donyell', 'Micky', 'Brian'],
    lastNames: ['De Jong', 'Van Dijk', 'De Ligt', 'Jansen', 'Bakker', 'Visser', 'Smit', 'Meijer', 'De Boer', 'Mulder', 'De Vries', 'Bos', 'Vos', 'Peters', 'Hendriks', 'Van de Ven', 'Gakpo', 'Dumfries', 'Koopmeiners', 'Simons']
  },
  // 6: Portugal
  6: {
    firstNames: ['Diogo', 'Bernardo', 'Bruno', 'Ruben', 'Joao', 'Cristiano', 'Goncalo', 'Pedro', 'Tiago', 'Andre', 'Rafael', 'Nuno', 'Vitinha', 'Matheus', 'Francisco', 'Antonio', 'Danilo', 'Nelson', 'Jose', 'Renato'],
    lastNames: ['Silva', 'Santos', 'Ferreira', 'Pereira', 'Oliveira', 'Costa', 'Rodrigues', 'Martins', 'Sousa', 'Fernandes', 'Goncalves', 'Gomes', 'Lopes', 'Marques', 'Alves', 'Ribeiro', 'Pinto', 'Carvalho', 'Teixeira', 'Dias']
  },
  // 7: Italy
  7: {
    firstNames: ['Federico', 'Nicolo', 'Lorenzo', 'Alessandro', 'Gianluigi', 'Marco', 'Matteo', 'Leonardo', 'Andrea', 'Francesco', 'Davide', 'Simone', 'Giacomo', 'Riccardo', 'Bryan', 'Manuel', 'Gianluca', 'Raoul', 'Samuele', 'Giorgio'],
    lastNames: ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'De Luca', 'Mancini', 'Costa', 'Giordano', 'Rizzo', 'Lombardi', 'Barella']
  },
  // 8: Croatia
  8: {
    firstNames: ['Luka', 'Mateo', 'Josko', 'Dominik', 'Marcelo', 'Andrej', 'Ivan', 'Mario', 'Borna', 'Lovro', 'Josip', 'Martin', 'Petar', 'Nikola', 'Ante', 'Bruno', 'Marin', 'Duje', 'Kristijan', 'Marko'],
    lastNames: ['Modric', 'Kovacic', 'Gvardiol', 'Brozovic', 'Perisic', 'Kramaric', 'Livakovic', 'Pasalic', 'Majer', 'Sosa', 'Vlasic', 'Petkovic', 'Sutalo', 'Stanisic', 'Erlic', 'Baturina', 'Ivanusec', 'Budimir', 'Pongracic', 'Labrovic']
  },
  // 9: Germany
  9: {
    firstNames: ['Florian', 'Lukas', 'Leon', 'Joshua', 'Kai', 'Thomas', 'Manuel', 'Niklas', 'Timo', 'Julian', 'Max', 'Felix', 'Jonas', 'Paul', 'Maximilian', 'Leroy', 'Jamal', 'Jonathan', 'Robert', 'David'],
    lastNames: ['Muller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Schafer', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf', 'Schroder', 'Neumann', 'Schwarz', 'Zimmermann']
  },
  // 10: Switzerland
  10: {
    firstNames: ['Granit', 'Manuel', 'Breel', 'Yann', 'Denis', 'Remo', 'Silvan', 'Fabian', 'Ruben', 'Michel', 'Dan', 'Steven', 'Zeki', 'Cedric', 'Gregor', 'Nico', 'Renato', 'Noah', 'Becir', 'Ardon'],
    lastNames: ['Xhaka', 'Akanji', 'Sommer', 'Zakaria', 'Embolo', 'Freuler', 'Widmer', 'Rodriguez', 'Schar', 'Steffen', 'Kobel', 'Ndoye', 'Aebischer', 'Vargas', 'Rieder', 'Zuber', 'Elvedi', 'Omeragic', 'Jashari', 'Amenda']
  },
  // 11: Denmark
  11: {
    firstNames: ['Christian', 'Kasper', 'Rasmus', 'Pierre', 'Andreas', 'Mikkel', 'Joachim', 'Yussuf', 'Jonas', 'Victor', 'Morten', 'Alexander', 'Mathias', 'Jens', 'Mads', 'Anders', 'Thomas', 'Simon', 'Frederik', 'Gustav'],
    lastNames: ['Eriksen', 'Hojlund', 'Schmeichel', 'Hojbjerg', 'Christensen', 'Kjaer', 'Lindstrom', 'Dolberg', 'Poulsen', 'Wind', 'Andersen', 'Maehle', 'Hjulmand', 'Bah', 'Kristiansen', 'Damsgaard', 'Vestergaard', 'Hermansen', 'Norgaard', 'Frendrup']
  },
  // 12: Austria
  12: {
    firstNames: ['David', 'Marcel', 'Christoph', 'Konrad', 'Marko', 'Michael', 'Stefan', 'Florian', 'Nicolas', 'Patrick', 'Philipp', 'Maximilian', 'Alexander', 'Leopold', 'Gernot', 'Romano', 'Kevin', 'Matthias', 'Phillipp', 'Florian'],
    lastNames: ['Alaba', 'Sabitzer', 'Baumgartner', 'Laimer', 'Arnautovic', 'Gregoritsch', 'Posch', 'Schlager', 'Seiwald', 'Grillitsch', 'Wober', 'Danso', 'Lienhart', 'Mwene', 'Prass', 'Schmid', 'Pentz', 'Trauner', 'Wimmer', 'Daniliuc']
  },
  // 13: Ukraine
  13: {
    firstNames: ['Mykhailo', 'Oleksandr', 'Artem', 'Viktor', 'Andriy', 'Ilya', 'Vitaliy', 'Roman', 'Heorhiy', 'Volodymyr', 'Taras', 'Mykola', 'Yukhym', 'Bohdan', 'Maksym', 'Vladyslav', 'Dmytro', 'Serhiy', 'Ivan', 'Oleksiy'],
    lastNames: ['Mudryk', 'Zinchenko', 'Dovbyk', 'Tsygankov', 'Yarmolenko', 'Zabarnyi', 'Mykolenko', 'Yaremchuk', 'Lunin', 'Sudakov', 'Stepanenko', 'Matviyenko', 'Konoplya', 'Shaparenko', 'Malinovskyi', 'Vanat', 'Trubin', 'Talovierov', 'Bondar', 'Brazhko']
  },
  // 14: Turkey
  14: {
    firstNames: ['Arda', 'Hakan', 'Kerem', 'Baris', 'Kenan', 'Ferdi', 'Orkun', 'Merih', 'Cenk', 'Zeki', 'Abdulkerim', 'Salih', 'Samet', 'Kaan', 'Okay', 'Yusuf', 'Semih', 'Ahmet', 'Ugurcan', 'Altay'],
    lastNames: ['Guler', 'Calhanoglu', 'Akturkoglu', 'Yilmaz', 'Yildiz', 'Kadioglu', 'Kokcu', 'Demiral', 'Tosun', 'Celik', 'Bardakci', 'Ozcan', 'Akaydin', 'Ayhan', 'Yokuslu', 'Yazici', 'Kilicsoy', 'Cakir', 'Bayindir', 'Yuksek']
  },
  // 15: Sweden
  15: {
    firstNames: ['Alexander', 'Dejan', 'Viktor', 'Emil', 'Robin', 'Jesper', 'Anthony', 'Isak', 'Gabriel', 'Carl', 'Ken', 'Ludwig', 'Hugo', 'Samuel', 'Lucas', 'Sebastian', 'Hjalmar', 'Jens', 'Anton', 'Linus'],
    lastNames: ['Isak', 'Kulusevski', 'Gyokeres', 'Forsberg', 'Olsen', 'Lindelof', 'Elanga', 'Hien', 'Svensson', 'Karlsson', 'Nilsson', 'Eriksson', 'Larsson', 'Augustinsson', 'Bergvall', 'Cajuste', 'Holm', 'Starfelt', 'Wahlstedt', 'Kurtulus']
  },
  // 16: Poland
  16: {
    firstNames: ['Robert', 'Piotr', 'Wojciech', 'Jakub', 'Sebastian', 'Nicola', 'Przemyslaw', 'Jan', 'Kacper', 'Bartosz', 'Karol', 'Krzysztof', 'Tymoteusz', 'Pawel', 'Damian', 'Marcin', 'Mateusz', 'Lukasz', 'Michal', 'Tomasz'],
    lastNames: ['Lewandowski', 'Zielinski', 'Szczesny', 'Kiwior', 'Frankowski', 'Szymanski', 'Zalewski', 'Bednarek', 'Moder', 'Slisz', 'Swiderski', 'Piatek', 'Puchacz', 'Dawidowicz', 'Salamon', 'Skorupski', 'Buksa', 'Urbanski', 'Walukiewicz', 'Bulka']
  },
  // 17: Russia
  17: {
    firstNames: ['Aleksandr', 'Aleksei', 'Matvei', 'Arsen', 'Fedor', 'Anton', 'Danil', 'Konstantin', 'Ivan', 'Dmitri', 'Maksim', 'Igor', 'Sergei', 'Andrei', 'Nikita', 'Mikhail', 'Vyacheslav', 'Roman', 'Georgi', 'Denis'],
    lastNames: ['Golovin', 'Miranchuk', 'Safonov', 'Zakharyan', 'Chalov', 'Smolov', 'Barinov', 'Fomin', 'Tyukavin', 'Glushenkov', 'Dzhikiya', 'Diveev', 'Karavaev', 'Khlusevich', 'Spertsyan', 'Krivtsov', 'Volkov', 'Karpov', 'Lantyratov', 'Oblyakov']
  },
  // 18: Norway
  18: {
    firstNames: ['Erling', 'Martin', 'Alexander', 'Sander', 'Julian', 'Leo', 'Antonio', 'Jorgen', 'Kristoffer', 'Patrick', 'Fredrik', 'Andreas', 'Marcus', 'David', 'Oscar', 'Hugo', 'Morten', 'Sverre', 'Henrik', 'Tobias'],
    lastNames: ['Haaland', 'Odegaard', 'Sorloth', 'Berge', 'Ryerson', 'Nusa', 'Ajer', 'Strand Larsen', 'Bobb', 'Ostigard', 'Berg', 'Wolfe', 'Nyland', 'Heggem', 'Vetlesen', 'Thorstvedt', 'Pedersen', 'Thorsby', 'Hanche-Olsen', 'Schjelderup']
  },
  // 19: Wales
  19: {
    firstNames: ['Aaron', 'Brennan', 'Harry', 'Daniel', 'Kieffer', 'Ethan', 'Ben', 'Neco', 'Joe', 'Jordan', 'Connor', 'Nathan', 'David', 'Chris', 'Rubin', 'Liam', 'Wes', 'Josh', 'Lewis', 'Sorba'],
    lastNames: ['Ramsey', 'Johnson', 'Wilson', 'James', 'Moore', 'Ampadu', 'Davies', 'Williams', 'Rodon', 'Mepham', 'Brooks', 'Roberts', 'Broadhead', 'Cullen', 'Colwill', 'Ward', 'Fox', 'Sheehan', 'Koumas', 'Thomas']
  },
  // 20: Scotland
  20: {
    firstNames: ['Andrew', 'Scott', 'John', 'Kieran', 'Billy', 'Che', 'Lyndon', 'Callum', 'Jack', 'Ryan', 'Grant', 'Lewis', 'Greg', 'Anthony', 'Liam', 'Ross', 'Kenny', 'Ben', 'Tommy', 'Stuart'],
    lastNames: ['Robertson', 'McTominay', 'McGinn', 'Tierney', 'Gilmour', 'Adams', 'Dykes', 'McGregor', 'Hendry', 'Christie', 'Hanley', 'Ferguson', 'Taylor', 'Ralston', 'Gunn', 'Shankland', 'McLean', 'Doak', 'Conway', 'Porteous']
  },
  // 21: Czech Republic
  21: {
    firstNames: ['Tomas', 'Patrik', 'Vladimir', 'Adam', 'Antonin', 'Ladislav', 'David', 'Lukas', 'Mojmir', 'Matej', 'Robin', 'Ondrej', 'Vaclav', 'Jindrich', 'Michal', 'Jan', 'Pavel', 'Jaroslav', 'Martin', 'Petr'],
    lastNames: ['Soucek', 'Schick', 'Coufal', 'Hlozek', 'Barak', 'Krejci', 'Jurasek', 'Provod', 'Chytil', 'Kovar', 'Hranac', 'Lingr', 'Cerny', 'Stanek', 'Doudera', 'Holes', 'Sulc', 'Kusej', 'Zima', 'Vlcek']
  },
  // 22: Greece
  22: {
    firstNames: ['Konstantinos', 'Anastasios', 'Georgios', 'Vangelis', 'Odysseas', 'Dimitrios', 'Petros', 'Fotis', 'Giannis', 'Christos', 'Manolis', 'Lazaros', 'Andreas', 'Panagiotis', 'Sotiris', 'Nikos', 'Marios', 'Stelios', 'Michalis', 'Alexandros'],
    lastNames: ['Tsimikas', 'Bakasetas', 'Mavropanos', 'Pavlidis', 'Vlachodimos', 'Masouras', 'Koulierakis', 'Pelkas', 'Retsos', 'Giannoulis', 'Ioannidis', 'Tzolis', 'Siopis', 'Rota', 'Hatzidiakos', 'Kourbelis', 'Mandas', 'Papanikolaou', 'Zafeiris', 'Vagiannidis']
  },
  // 23: Serbia
  23: {
    firstNames: ['Dusan', 'Aleksandar', 'Sergej', 'Strahinja', 'Nikola', 'Filip', 'Lazar', 'Sasa', 'Milos', 'Luka', 'Vanja', 'Predrag', 'Nemanja', 'Ivan', 'Andrija', 'Uros', 'Srdjan', 'Petar', 'Veljko', 'Kosta'],
    lastNames: ['Vlahovic', 'Mitrovic', 'Milinkovic-Savic', 'Pavlovic', 'Milenkovic', 'Kostic', 'Samardzic', 'Lukic', 'Gudelj', 'Jovic', 'Rajkovic', 'Maksimovic', 'Zivkovic', 'Birmancevic', 'Nedeljkovic', 'Babic', 'Ilic', 'Ratkov', 'Spajic', 'Stojic']
  },
  // 24: Romania
  24: {
    firstNames: ['Radu', 'Nicolae', 'Dennis', 'Razvan', 'Ianis', 'Andrei', 'Florinel', 'Valentin', 'Denis', 'Marius', 'Darius', 'Horatiu', 'Adrian', 'Bogdan', 'Deian', 'Alexandru', 'George', 'Stefan', 'Cristian', 'Mihai'],
    lastNames: ['Dragusin', 'Stanciu', 'Man', 'Marin', 'Hagi', 'Ratiu', 'Coman', 'Mihaila', 'Dragus', 'Burca', 'Olaru', 'Moldovan', 'Sorescu', 'Bancu', 'Alibec', 'Puscas', 'Nita', 'Rus', 'Nedelcearu', 'Sut']
  },
  // 25: Slovakia
  25: {
    firstNames: ['Milan', 'Stanislav', 'Ondrej', 'David', 'Martin', 'Lukas', 'Leo', 'Robert', 'Juraj', 'Denis', 'Tomas', 'Matus', 'Adam', 'Norbert', 'Vernon', 'Patrik', 'Marek', 'Peter', 'Michal', 'Jan'],
    lastNames: ['Skriniar', 'Lobotka', 'Duda', 'Hancko', 'Dubravka', 'Haraslin', 'Sauer', 'Bozenik', 'Kucka', 'Vavro', 'Suslov', 'Bero', 'Obert', 'Gyomber', 'De Marco', 'Strelec', 'Tupta', 'Ravas', 'Duris', 'Kmet']
  },
  // 26: Slovenia
  26: {
    firstNames: ['Jan', 'Benjamin', 'Jaka', 'Petar', 'Sandi', 'Zan', 'Andraz', 'Timi', 'Adam', 'Erik', 'Miha', 'David', 'Jon', 'Nino', 'Vid', 'Igor', 'Jasmin', 'Blaz', 'Tilen', 'Nejc'],
    lastNames: ['Oblak', 'Sesko', 'Bijol', 'Stojanovic', 'Lovric', 'Vipotnik', 'Sporar', 'Elsnik', 'Gnezda Cerin', 'Janza', 'Karnicnik', 'Drkusic', 'Brekalo', 'Zugelj', 'Kek', 'Vekic', 'Belec', 'Balkovec', 'Celar', 'Kramaric']
  },
  // 27: Republic of Ireland
  27: {
    firstNames: ['Evan', 'Caoimhin', 'Nathan', 'Josh', 'Chiedozie', 'Matt', 'Jason', 'Jayson', 'Will', 'Festy', 'Andrew', 'Liam', 'Robbie', 'Troy', 'Adam', 'Mark', 'Callum', 'Michael', 'Jack', 'Ryan'],
    lastNames: ['Ferguson', 'Kelleher', 'Collins', 'Cullen', 'Ogbene', 'Doherty', 'Knight', 'Molumby', 'Smallbone', 'Ebosele', 'Omobamidele', 'Scales', 'Brady', 'Parrott', 'Idah', 'Travers', 'O\'Shea', 'Johnston', 'Azaz', 'Cannon']
  },
  // 28: Finland
  28: {
    firstNames: ['Teemu', 'Glen', 'Lukas', 'Oliver', 'Fredrik', 'Kaan', 'Robin', 'Robert', 'Benjamin', 'Rasmus', 'Matti', 'Jere', 'Leo', 'Anssi', 'Jesse', 'Carljohan', 'Viljami', 'Santeri', 'Topi', 'Miro'],
    lastNames: ['Pukki', 'Kamara', 'Hradecky', 'Antman', 'Jensen', 'Kairinen', 'Lod', 'Pohjanpalo', 'Ivanov', 'Schuller', 'Peltona', 'Uronen', 'Vaisanen', 'Suhonen', 'Joronen', 'Sinusalo', 'Hoskonen', 'Nissila', 'Tenho', 'Walta']
  },
  // 29: Hungary
  29: {
    firstNames: ['Dominik', 'Roland', 'Milos', 'Peter', 'Willi', 'Barnabas', 'Andras', 'Adam', 'Bendeguz', 'Loic', 'Martin', 'Zsolt', 'Botond', 'Daniel', 'Attila', 'Krisztofer', 'Denes', 'Balazs', 'Zalan', 'Gabor'],
    lastNames: ['Szoboszlai', 'Sallai', 'Kerkez', 'Gulacsi', 'Orban', 'Varga', 'Schafer', 'Nagy', 'Bolla', 'Nego', 'Adam', 'Kalmar', 'Balogh', 'Gazdag', 'Szalai', 'Horvath', 'Dibusz', 'Toth', 'Kata', 'Csoboth'],
    isLastNameFirst: true
  },
  // 30: Georgia
  30: {
    firstNames: ['Khvicha', 'Georges', 'Giorgi', 'Zuriko', 'Otar', 'Saba', 'Budu', 'Anzor', 'Nika', 'Luka', 'Guram', 'Levan', 'Lasha', 'Irakli', 'Davit', 'Jaba', 'Vakhtang', 'Tornike', 'Solomon', 'Gia'],
    lastNames: ['Kvaratskhelia', 'Mikautadze', 'Mamardashvili', 'Davitashvili', 'Kiteishvili', 'Goglichidze', 'Zivzivadze', 'Mekvabishvili', 'Kverkvelia', 'Lochoshvili', 'Kashia', 'Kakabadze', 'Chakvetadze', 'Tsitaishvili', 'Kochorashvili', 'Shengelia', 'Gvelesiani', 'Loria', 'Kalandadze', 'Altunashvili']
  },
  // 31: Albania
  31: {
    firstNames: ['Armando', 'Kristjan', 'Nedim', 'Berat', 'Thomas', 'Elseid', 'Ernest', 'Mario', 'Ylber', 'Mirlind', 'Arbnor', 'Taulant', 'Rey', 'Klaus', 'Etrit', 'Ardian', 'Medon', 'Naser', 'Ivan', 'Indrit'],
    lastNames: ['Broja', 'Asllani', 'Bajrami', 'Djimsiti', 'Strakosha', 'Hysaj', 'Muci', 'Mitaj', 'Ramadani', 'Daku', 'Muja', 'Seferi', 'Manaj', 'Gjasula', 'Berisha', 'Ismajli', 'Kumbulla', 'Aliji', 'Hoxha', 'Doka']
  },
  // 32: Iceland
  32: {
    firstNames: ['Hakon', 'Johann', 'Albert', 'Sverrir', 'Jon', 'Arnor', 'Andri', 'Gylfi', 'Victor', 'Stefan', 'Daniel', 'Kolbeinn', 'Alfons', 'Mikael', 'Isak', 'Elias', 'Patrik', 'Hordur', 'Aron', 'Kristian'],
    lastNames: ['Haraldsson', 'Gudmundsson', 'Gudjohnsen', 'Ingason', 'Thorsteinsson', 'Sigurdsson', 'Traustason', 'Palsson', 'Sampsted', 'Eyjolfsson', 'Thordarson', 'Anderson', 'Gunnarsson', 'Olafsson', 'Hlynsson', 'Magnusson', 'Valdimarsson', 'Willumsson', 'Johannesson', 'Ellertsson']
  },
  // 33: Argentina
  33: {
    firstNames: ['Lionel', 'Julian', 'Enzo', 'Alexis', 'Rodrigo', 'Lautaro', 'Emiliano', 'Cristian', 'Nahuel', 'Lisandro', 'Nicolas', 'Angel', 'Thiago', 'Alejandro', 'Exequiel', 'Giovani', 'Valentin', 'Facundo', 'Matias', 'Lucas'],
    lastNames: ['Messi', 'Alvarez', 'Fernandez', 'Mac Allister', 'De Paul', 'Martinez', 'Romero', 'Molina', 'Otamendi', 'Tagliafico', 'Di Maria', 'Garnacho', 'Paredes', 'Lo Celso', 'Palacios', 'Gonzalez', 'Simeone', 'Buendia', 'Carboni', 'Barco']
  },
  // 34: Brazil
  34: {
    firstNames: ['Vinicius', 'Rodrygo', 'Gabriel', 'Bruno', 'Lucas', 'Raphinha', 'Richarlison', 'Casemiro', 'Alisson', 'Ederson', 'Marquinhos', 'Eder', 'Douglas', 'Endrick', 'Savinho', 'Danilo', 'Bento', 'Wendell', 'Murillo', 'Arthur'],
    lastNames: ['Junior', 'Guimaraes', 'Paqueta', 'Dias', 'Magalhaes', 'Jesus', 'Militao', 'Bremer', 'Luiz', 'Beraldo', 'Wendell', 'Vanderson', 'Caio', 'Gomes', 'Martinelli', 'Pedro', 'Evanilson', 'Arana', 'Andre', 'Silva']
  },
  // 35: Colombia
  35: {
    firstNames: ['Luis', 'James', 'Jhon', 'Jefferson', 'Davinson', 'Daniel', 'Camilo', 'Yerry', 'Richard', 'Mateus', 'Kevin', 'Carlos', 'Yaser', 'Santiago', 'Johan', 'Alvaro', 'Jorge', 'David', 'Rafael', 'Wilmar'],
    lastNames: ['Diaz', 'Rodriguez', 'Arias', 'Lerma', 'Sanchez', 'Munoz', 'Vargas', 'Mina', 'Rios', 'Uribe', 'Castano', 'Duran', 'Cuesta', 'Asprilla', 'Sinisterra', 'Mojica', 'Montero', 'Carrascal', 'Ospina', 'Borre']
  },
  // 36: Uruguay
  36: {
    firstNames: ['Federico', 'Darwin', 'Ronald', 'Manuel', 'Sergio', 'Rodrigo', 'Facundo', 'Mathias', 'Sebastian', 'Jose', 'Nicolas', 'Brian', 'Nahitan', 'Giorgian', 'Guillermo', 'Lucas', 'Cristian', 'Maximiliano', 'Santiago', 'Franco'],
    lastNames: ['Valverde', 'Nunez', 'Araujo', 'Ugarte', 'Rochet', 'Bentancur', 'Pellistri', 'Olivera', 'Caceres', 'Gimenez', 'De la Cruz', 'Rodriguez', 'Nandez', 'De Arrascaeta', 'Varela', 'Torrado', 'Olaza', 'Mele', 'Israel', 'Suarez']
  },
  // 37: Ecuador
  37: {
    firstNames: ['Moises', 'Piero', 'Enner', 'Pervis', 'Felix', 'Willian', 'Angelo', 'Alan', 'Kendry', 'Jeremy', 'Kevin', 'Hernan', 'Jordy', 'John', 'Jose', 'Carlos', 'Alexander', 'Angel', 'Pedro', 'Jhoanner'],
    lastNames: ['Caicedo', 'Hincapie', 'Valencia', 'Estupinan', 'Torres', 'Pacho', 'Preciado', 'Franco', 'Paez', 'Sarmiento', 'Rodriguez', 'Galindez', 'Yeboah', 'Cifuentes', 'Gruezo', 'Dominguez', 'Mena', 'Ortiz', 'Chavez', 'Plata']
  },
  // 38: Chile
  38: {
    firstNames: ['Alexis', 'Arturo', 'Ben', 'Marcelino', 'Paulo', 'Gabriel', 'Erick', 'Brayan', 'Victor', 'Rodrigo', 'Dario', 'Felipe', 'Thomas', 'Mauricio', 'Guillermo', 'Diego', 'Vicente', 'Alexander', 'Carlos', 'Gonzalo'],
    lastNames: ['Sanchez', 'Vidal', 'Brereton Diaz', 'Nunez', 'Diaz', 'Suazo', 'Pulgar', 'Cortes', 'Davila', 'Echeverria', 'Osorio', 'Loyola', 'Galdames', 'Isla', 'Maripan', 'Valdes', 'Pizarro', 'Aravena', 'Palacios', 'Tapia']
  },
  // 39: Paraguay
  39: {
    firstNames: ['Julio', 'Miguel', 'Gustavo', 'Ramon', 'Mathias', 'Diego', 'Omar', 'Fabian', 'Antonio', 'Damian', 'Alejandro', 'Junior', 'Ivan', 'Angel', 'Adam', 'Kaku', 'Roberto', 'Hernan', 'Blas', 'Mateo'],
    lastNames: ['Enciso', 'Almiron', 'Gomez', 'Sosa', 'Villasanti', 'Alderete', 'Balbuena', 'Sanabria', 'Bobadilla', 'Romero', 'Alonso', 'Ramirez', 'Bareiro', 'Gamarra', 'Fernandez', 'Perez', 'Riveros', 'Coronel', 'Cardozo', 'Rojas']
  },
  // 40: Bolivia
  40: {
    firstNames: ['Marcelo', 'Ramiro', 'Roberto', 'Carmelo', 'Miguel', 'Luis', 'Hector', 'Diego', 'Gabriel', 'Boris', 'Guillermo', 'Jairo', 'Jose', 'Jeyson', 'Moises', 'Leonel', 'Adalid', 'Bruno', 'Yomar', 'Enzo'],
    lastNames: ['Martins', 'Vaca', 'Fernandez', 'Algaranaz', 'Terceros', 'Haquin', 'Cuellar', 'Medina', 'Villamil', 'Cespedes', 'Viscarra', 'Quinteros', 'Sagredo', 'Chura', 'Justiniano', 'Terrazas', 'Miranda', 'Rocha', 'Monteiro', 'Lampe']
  },
  // 41: United States
  41: {
    firstNames: ['Christian', 'Weston', 'Yunus', 'Folarin', 'Antonee', 'Timothy', 'Tyler', 'Chris', 'Matt', 'Gio', 'Malik', 'Joe', 'Mark', 'Johnny', 'Ricardo', 'Haji', 'Miles', 'Tim', 'Luca', 'Patrick'],
    lastNames: ['Pulisic', 'McKennie', 'Musah', 'Balogun', 'Robinson', 'Weah', 'Adams', 'Richards', 'Turner', 'Reyna', 'Tillman', 'Scally', 'McKenzie', 'Cardoso', 'Pepi', 'Wright', 'Ream', 'De la Torre', 'Schulte', 'Aaronson']
  },
  // 42: Mexico
  42: {
    firstNames: ['Edson', 'Santiago', 'Hirving', 'Cesar', 'Johan', 'Luis', 'Orbelin', 'Jorge', 'Guillermo', 'Uriel', 'Julian', 'Gerardo', 'Carlos', 'Jesus', 'Erick', 'Roberto', 'Marcel', 'Raul', 'Alexis', 'Henry'],
    lastNames: ['Alvarez', 'Gimenez', 'Lozano', 'Montes', 'Vasquez', 'Chavez', 'Pineda', 'Sanchez', 'Ochoa', 'Antuna', 'Quinones', 'Arteaga', 'Rodriguez', 'Gallardo', 'Alvarado', 'Romo', 'Ruiz', 'Jimenez', 'Vega', 'Martin']
  },
  // 43: Canada
  43: {
    firstNames: ['Alphonso', 'Jonathan', 'Stephen', 'Tajon', 'Cyle', 'Ismael', 'Derek', 'Moise', 'Maxime', 'Richie', 'Alistair', 'Jacob', 'Liam', 'Samuel', 'Theo', 'Mathieu', 'Luc', 'Dayne', 'Ali', 'Tani'],
    lastNames: ['Davies', 'David', 'Eustaquio', 'Buchanan', 'Larin', 'Kone', 'Cornelius', 'Bombito', 'Crepeau', 'Laryea', 'Johnston', 'Shaffelburg', 'Millar', 'Piette', 'Bair', 'Choiniere', 'de Fougerolles', 'St. Clair', 'Ahmed', 'Oluwaseyi']
  },
  // 44: Panama
  44: {
    firstNames: ['Adalberto', 'Michael', 'Yoel', 'Jose', 'Fidel', 'Anibal', 'Edgar', 'Eric', 'Orlando', 'Ismael', 'Eduardo', 'Cesar', 'Jovani', 'Carlos', 'Kahiser', 'Freddy', 'Martin', 'Omar', 'Ivan', 'Jose Luis'],
    lastNames: ['Carrasquilla', 'Murillo', 'Barcenas', 'Rodriguez', 'Escobar', 'Godoy', 'Davis', 'Fajardo', 'Mosquera', 'Cordoba', 'Diaz', 'Guerrero', 'Blackman', 'Welch', 'Harvey', 'Lenis', 'Gondola', 'Moran', 'Valencia', 'Anderson']
  },
  // 45: Costa Rica
  45: {
    firstNames: ['Keylor', 'Joel', 'Manfred', 'Francisco', 'Juan', 'Brandon', 'Haxzel', 'Joseth', 'Jeyland', 'Gerald', 'Jefferson', 'Alvaro', 'Warren', 'Anthony', 'Kenneth', 'Fernan', 'Douglas', 'Patrick', 'Julio', 'Alexis'],
    lastNames: ['Navas', 'Campbell', 'Ugalde', 'Calvo', 'Vargas', 'Aguilera', 'Quiros', 'Taylor', 'Mitchell', 'Brenes', 'Zamora', 'Madrigal', 'Contreras', 'Faerron', 'Lopez', 'Sequeira', 'Cascante', 'Gamboa', 'Bennette', 'Mora']
  },
  // 46: Jamaica
  46: {
    firstNames: ['Leon', 'Michail', 'Bobby', 'Ethan', 'Demarai', 'Shamar', 'Kasey', 'Joel', 'Greg', 'Damion', 'Renaldo', 'Dexter', 'Karoy', 'Tayvon', 'Amari\'i', 'Jon', 'Jahmali', 'Richard', 'Kaheim', 'Norman'],
    lastNames: ['Bailey', 'Antonio', 'De Cordova-Reid', 'Pinnock', 'Gray', 'Nicholson', 'Palmer', 'Latibeaudiere', 'Leigh', 'Lowe', 'Cephas', 'Lembikisa', 'Anderson', 'Bell', 'Russell', 'Waite', 'King', 'Dixon', 'Campbell', 'Burke']
  },
  // 47: Honduras
  47: {
    firstNames: ['Anthony', 'Luis', 'Alberth', 'Kervin', 'Deybi', 'Denil', 'Andy', 'Edwin', 'Edrick', 'Joseph', 'Rigoberto', 'Bryan', 'Alexander', 'Carlos', 'Marcelo', 'Jorge', 'Devron', 'Maylor', 'Douglas', 'Marlon'],
    lastNames: ['Lozano', 'Palma', 'Elis', 'Arriaga', 'Flores', 'Maldonado', 'Najar', 'Rodriguez', 'Menjivar', 'Rosales', 'Rivas', 'Acosta', 'Lopez', 'Pineda', 'Santos', 'Alvarez', 'Garcia', 'Nunez', 'Martinez', 'Licona']
  },
  // 48: El Salvador
  48: {
    firstNames: ['Brayan', 'Jairo', 'Nelson', 'Darwin', 'Christian', 'Narciso', 'Bryan', 'Alex', 'Mayer', 'Leonardo', 'Tereso', 'Melvin', 'Adan', 'Jorge', 'Amando', 'Rudy', 'Kevin', 'Tomas', 'Roberto', 'Mario'],
    lastNames: ['Gil', 'Henriquez', 'Bonilla', 'Ceren', 'Martinez', 'Orellana', 'Tamacas', 'Roldan', 'Menjivar', 'Benitez', 'Cartagena', 'Climaco', 'Cruz', 'Moreno', 'Valencia', 'Reyes', 'Romero', 'Dominguez', 'Gonzalez', 'Flores']
  },
  // 49: Japan
  49: {
    firstNames: ['Takefusa', 'Kaoru', 'Wataru', 'Ritsu', 'Daichi', 'Takehiro', 'Zion', 'Hidemasa', 'Ko', 'Ao', 'Junya', 'Keito', 'Koki', 'Takumi', 'Hiroki', 'Yukinari', 'Shogo', 'Ayase', 'Kosei', 'Reo', 'Daizen', 'Kyogo', 'Hayao', 'Yuta'],
    lastNames: ['Kubo', 'Mitoma', 'Endo', 'Doan', 'Kamada', 'Tomiyasu', 'Suzuki', 'Morita', 'Itakura', 'Tanaka', 'Ito', 'Nakamura', 'Ogawa', 'Minamino', 'Machida', 'Sugawara', 'Taniguchi', 'Ueda', 'Tani', 'Hatate', 'Maeda', 'Furuhashi', 'Kawabe', 'Nakayama']
  },
  // 50: Iran
  50: {
    firstNames: ['Mehdi', 'Sardar', 'Alireza', 'Saman', 'Saeid', 'Milad', 'Shoja', 'Hossein', 'Ramin', 'Omid', 'Payam', 'Ali', 'Mohammad', 'Aria', 'Saleh', 'Mohammadreza', 'Javad', 'Seyed', 'Sadegh', 'Danial'],
    lastNames: ['Taremi', 'Azmoun', 'Jahanbakhsh', 'Ghoddos', 'Ezatolahi', 'Mohammadi', 'Khalilzadeh', 'Kanaanizadegan', 'Rezaeian', 'Noorafkan', 'Niazmand', 'Gholizadeh', 'Mohebi', 'Yousefi', 'Hardani', 'Azadi', 'Aghasi', 'Hosseini', 'Moharrami', 'Esmaeilifar']
  },
  // 51: South Korea
  51: {
    firstNames: ['Heung-min', 'Kang-in', 'Min-jae', 'Hee-chan', 'In-beom', 'Jae-sung', 'Hyun-seok', 'Young-woo', 'Seung-ho', 'Gue-sung', 'Hyun-woo', 'Bum-keun', 'Yu-min', 'Jin-seob', 'Won-sang', 'Ji-soo', 'Jun-ho', 'Min-hyeok', 'Se-hun', 'Jin-su'],
    lastNames: ['Son', 'Lee', 'Kim', 'Hwang', 'Cho', 'Hong', 'Seol', 'Paik', 'Jeong', 'Song', 'Park', 'Oh', 'Bae', 'Jung', 'Yang', 'Choi', 'Kwon', 'Moon', 'Eom', 'Ko']
  },
  // 52: Australia
  52: {
    firstNames: ['Harry', 'Jackson', 'Mitchell', 'Mathew', 'Cameron', 'Martin', 'Riley', 'Jordan', 'Craig', 'Keanu', 'Kye', 'Nestory', 'Alessandro', 'Connor', 'Lewis', 'Aziz', 'Samuel', 'Thomas', 'Joe', 'Apostolos'],
    lastNames: ['Souttar', 'Irvine', 'Duke', 'Ryan', 'Burgess', 'Boyle', 'McGree', 'Bos', 'Goodwin', 'Baccus', 'Rowles', 'Irankunda', 'Circati', 'Metcalfe', 'Miller', 'Behich', 'Silveria', 'Deng', 'Gauci', 'Stamatelopoulos']
  },
  // 53: Qatar
  53: {
    firstNames: ['Akram', 'Almoez', 'Hassan', 'Pedro', 'Lucas', 'Tarek', 'Mohammed', 'Assim', 'Bassam', 'Meshaal', 'Yusuf', 'Homam', 'Mostafa', 'Ahmed', 'Jassem', 'Abdelrahman', 'Sultan', 'Saad', 'Naif', 'Salah'],
    lastNames: ['Afif', 'Ali', 'Al-Haydos', 'Miguel', 'Mendes', 'Salman', 'Waad', 'Madibo', 'Al-Rawi', 'Barsham', 'Abdurisag', 'Ahmed', 'Mashaal', 'Alaaeldin', 'Gaber', 'Moustafa', 'Al-Brake', 'Al-Sheeb', 'Al-Hadhrami', 'Zakaria']
  },
  // 54: Saudi Arabia
  54: {
    firstNames: ['Salem', 'Firas', 'Saud', 'Ali', 'Abdulelah', 'Sultan', 'Hassan', 'Musab', 'Mohamed', 'Nasser', 'Awn', 'Faisal', 'Abdullah', 'Marwan', 'Ahmed', 'Saleh', 'Ayman', 'Rayan', 'Raghed', 'Fahad'],
    lastNames: ['Al-Dawsari', 'Al-Buraikan', 'Abdulhamid', 'Al-Bulayhi', 'Al-Malki', 'Al-Ghannam', 'Tambakti', 'Al-Juwayr', 'Kanno', 'Al-Saluli', 'Al-Ghamdi', 'Radif', 'Al-Sahafi', 'Al-Khaibari', 'Al-Shehri', 'Yahya', 'Hamed', 'Najjar', 'Al-Muwallad', 'Al-Owais']
  },
  // 55: Uzbekistan
  55: {
    firstNames: ['Eldor', 'Abbosbek', 'Oston', 'Jaloliddin', 'Odiljon', 'Abdukodir', 'Rustam', 'Sherzod', 'Husniddin', 'Utkir', 'Khojiakbar', 'Akmal', 'Otabek', 'Diyor', 'Bobur', 'Umar', 'Ibrokhim', 'Mukhammadkodir', 'Azizbek', 'Khumoyun'],
    lastNames: ['Shomurodov', 'Fayzullaev', 'Urunov', 'Masharipov', 'Hamrobekov', 'Khusanov', 'Ashurmatov', 'Nasrullaev', 'Alikulov', 'Yusupov', 'Alijonov', 'Mozgovoy', 'Shukurov', 'Kholmatov', 'Abdikholikov', 'Eshmurodov', 'Khalilulayev', 'Hamraliev', 'Turgunboev', 'Murtazaev']
  },
  // 56: Iraq
  56: {
    firstNames: ['Aymen', 'Ali', 'Mohanad', 'Zidane', 'Ibrahim', 'Youssef', 'Rebin', 'Hussein', 'Merchas', 'Amir', 'Saad', 'Mustafa', 'Ahmed', 'Osama', 'Danilo', 'Montader', 'Marko', 'Louai', 'Fahad', 'Alaa'],
    lastNames: ['Hussein', 'Jasim', 'Ali', 'Iqbal', 'Bayesh', 'Amyn', 'Sulaka', 'Doski', 'Al-Ammari', 'Natiq', 'Saadoun', 'Yahya', 'Rashid', 'Al-Saed', 'Madjed', 'Farhan', 'El Ani', 'Basil', 'Talib', 'Mhawi']
  },
  // 57: Jordan
  57: {
    firstNames: ['Mousa', 'Yazan', 'Ali', 'Ehsan', 'Nizar', 'Noor', 'Abdallah', 'Mahmoud', 'Saed', 'Yazeed', 'Bara', 'Mohammad', 'Ibrahim', 'Rajaei', 'Aref', 'Youssef', 'Salem', 'Feras', 'Anas', 'Ahmad'],
    lastNames: ['Al-Tamari', 'Al-Naimat', 'Olwan', 'Haddad', 'Al-Rashdan', 'Al-Rawabdeh', 'Nasib', 'Al-Mardi', 'Al-Rosan', 'Abulaila', 'Maree', 'Abu Hasheesh', 'Sadeh', 'Ayed', 'Al-Haj', 'Abu Jalboush', 'Al-Ajalin', 'Shilbaya', 'Bani Yaseen', 'Juaidi']
  },
  // 58: United Arab Emirates
  58: {
    firstNames: ['Fabio', 'Ali', 'Caio', 'Yahya', 'Harib', 'Tahnoon', 'Khalid', 'Bader', 'Zayed', 'Marcus', 'Khalifa', 'Abdulla', 'Kouame', 'Mackenzie', 'Sultan', 'Mohammed', 'Majed', 'Issam', 'Bruno', 'Walid'],
    lastNames: ['Lima', 'Saleh', 'Canedo', 'Al-Ghassani', 'Abdalla', 'Al-Zaabi', 'Eisa', 'Nasser', 'Sultan', 'Meloni', 'Al-Hammadi', 'Idrees', 'Autonne', 'Hunt', 'Salmeen', 'Adil', 'Al-Attas', 'Rashid', 'Faiz', 'Abbas']
  },
  // 59: Oman
  59: {
    firstNames: ['Issam', 'Salaah', 'Jameel', 'Muhsen', 'Arshad', 'Harib', 'Ahmed', 'Khalid', 'Zahir', 'Ibrahim', 'Ghanim', 'Amjad', 'Abdulrahman', 'Thani', 'Musab', 'Abdullah', 'Fahmi', 'Omer', 'Nasser', 'Faiz'],
    lastNames: ['Al-Sabhi', 'Al-Yahyaei', 'Al-Yahmadi', 'Al-Ghassani', 'Al-Alawi', 'Al-Saadi', 'Al-Khamisi', 'Al-Buraiki', 'Al-Aghbari', 'Al-Mukhaini', 'Al-Habashi', 'Al-Harthi', 'Al-Mushaifri', 'Al-Rushedi', 'Al-Mamari', 'Fawaz', 'Durbin', 'Al-Malki', 'Al-Rawahi', 'Al-Rushaidi']
  },
  // 60: Bahrain
  60: {
    firstNames: ['Abdulla', 'Mahdi', 'Ali', 'Komail', 'Mohamed', 'Hazza', 'Sayed', 'Waleed', 'Ebrahim', 'Jasim', 'Moses', 'Vincent', 'Hamad', 'Ahmed', 'Abbas', 'Ammar', 'Husain', 'Mubarak', 'Talal', 'Salem'],
    lastNames: ['Yusuf Helal', 'Abduljabbar', 'Madan', 'Al-Aswad', 'Marhoon', 'Ali', 'Baqer', 'Al-Hayam', 'Lutfalla', 'Al-Shaikh', 'Atede', 'Emmanuel', 'Shamsan', 'Bughammar', 'Al-Asfoor', 'Jaafar', 'Al-Khulasi', 'Al-Romaihi', 'Al-Shorooqi', 'Adel']
  },
  // 61: China
  61: {
    firstNames: ['Lei', 'Yuning', 'Shihao', 'Guangtai', 'Shangyuan', 'Chenjie', 'Yang', 'Ke', 'Wai-tsun', 'Junling', 'Zhunyi', 'Pengfei', 'Lin', 'Dinghao', 'Tianyi', 'Shenglong', 'Haoyang', 'Zhen', 'Yongjing', 'Zeyan'],
    lastNames: ['Wu', 'Zhang', 'Wei', 'Jiang', 'Wang', 'Zhu', 'Liu', 'Li', 'Dai', 'Yan', 'Gao', 'Xie', 'Liang', 'Xu', 'Cheng', 'Han', 'Huang', 'Zhao', 'Chen', 'Lin'],
    isLastNameFirst: true
  },
  // 62: Syria
  62: {
    firstNames: ['Omar', 'Pablo', 'Ibrahim', 'Ammar', 'Ezequiel', 'Moayad', 'Thaer', 'Jalil', 'Fahd', 'Aiham', 'Elmar', 'Noah', 'Antonio', 'Alaa', 'Kamel', 'Mohamad', 'Taha', 'Ahmad', 'Maksim', 'Amr'],
    lastNames: ['Khribin', 'Sabbag', 'Hesar', 'Ramadan', 'Ham', 'Ajan', 'Krouma', 'Elias', 'Youssef', 'Ousou', 'Abraham', 'Shamoun', 'Yakoub', 'Al-Dali', 'Hmeisheh', 'Anez', 'Mousa', 'Madania', 'Sarraf', 'Midani']
  },
  // 63: Palestine
  63: {
    firstNames: ['Oday', 'Tamer', 'Zaid', 'Camilo', 'Musab', 'Mohammed', 'Michel', 'Rami', 'Mahmoud', 'Ameed', 'Jonathan', 'Yaser', 'Wessam', 'Bader', 'Samer', 'Islam', 'Mousa', 'Mahdi', 'Amir', 'Alaa'],
    lastNames: ['Dabbagh', 'Seyam', 'Qunbar', 'Saldana', 'Battat', 'Rashid', 'Termanini', 'Hamada', 'Abu Warda', 'Sawafta', 'Cantillana', 'Hamed', 'Abou Ali', 'Mousa', 'Jundi', 'Batran', 'Farawi', 'Issa', 'Kharoub', 'Hassan']
  },
  // 64: Thailand
  64: {
    firstNames: ['Chanathip', 'Theerathon', 'Teerasil', 'Supachok', 'Suphanat', 'Supachai', 'Nicholas', 'Kritsada', 'Sarach', 'Peeradol', 'Weerathep', 'Patiwat', 'Pansa', 'Elias', 'Jaroensak', 'Sasalak', 'Bordin', 'Channarong', 'Poramet', 'Worachit'],
    lastNames: ['Songkrasin', 'Bunmathan', 'Dangda', 'Sarachat', 'Mueanta', 'Jaided', 'Mickelson', 'Kaman', 'Yooyen', 'Chamratsamee', 'Pomphan', 'Khammai', 'Hemviboon', 'Dolah', 'Wonggorn', 'Haiprakhon', 'Phala', 'Promsrikaew', 'Arjvirai', 'Kanitsribampen']
  },
  // 65: Vietnam
  65: {
    firstNames: ['Quang Hải', 'Văn Toàn', 'Tiến Linh', 'Tuấn Anh', 'Duy Mạnh', 'Hoàng Đức', 'Văn Hậu', 'Thành Chung', 'Tấn Tài', 'Việt Anh', 'Văn Lâm', 'Ngọc Hải', 'Thanh Bình', 'Tuấn Hải', 'Đình Bắc', 'Thái Sơn', 'Văn Khang', 'Xuân Mạnh', 'Hùng Dũng', 'Văn Thanh', 'Tiến Dũng', 'Văn Chuẩn', 'Vĩ Hào', 'Thanh Nhàn', 'Minh Trọng', 'Đức Phú', 'Quốc Việt', 'Văn Tùng', 'Hồng Duy', 'Đình Trọng', 'Công Phượng', 'Xuân Trường', 'Văn Quyết', 'Trọng Hoàng', 'Anh Đức'],
    lastNames: ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Phan', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Đoàn', 'Lương', 'Trịnh', 'Đinh', 'Võ', 'Mai'],
    isLastNameFirst: true
  },
  // 66: North Korea
  66: {
    firstNames: ['Kwang-ryong', 'Il-gwan', 'Kuk-chol', 'Un-chol', 'Pom-hyok', 'Yu-song', 'Jo-guk', 'Jin-hyok', 'Tam', 'Kwang-hun', 'Kum-song', 'Chung-song', 'Hyok-chol', 'Song-hyeok', 'Il-song', 'Kuk-jin', 'Kang-guk', 'Tae-song', 'Phyong-guk', 'Myong-song'],
    lastNames: ['Pak', 'Jong', 'Ri', 'Kim', 'Kang', 'Han', 'Choe', 'Sin', 'An', 'So', 'Jang', 'Mun', 'Hong', 'Yun', 'Kye', 'O', 'Kwon', 'Sim', 'Ro', 'Pae'],
    isLastNameFirst: true
  },
  // 67: Tajikistan
  67: {
    firstNames: ['Parvizdzhon', 'Alisher', 'Rustam', 'Vakhdat', 'Manuchekhr', 'Ehson', 'Zoir', 'Tabrezi', 'Mukhriddin', 'Amadoni', 'Shakhrom', 'Daler', 'Alidzhoni', 'Sodikdzhon', 'Kholmurod', 'Komron', 'Fathullo', 'Nuriddin', 'Sheriddin', 'Vaisiddin'],
    lastNames: ['Umarbaev', 'Dzhalilov', 'Soirov', 'Khanonov', 'Safarov', 'Panjshanbe', 'Dzhuraboev', 'Davlatmir', 'Khasanov', 'Kamolov', 'Samiev', 'Imomnazarov', 'Ayni', 'Kurbonov', 'Nazarov', 'Tursunov', 'Barotov', 'Rakhimov', 'Boboev', 'Mabatshoev']
  },
  // 68: Lebanon
  68: {
    firstNames: ['Hassan', 'Mohamad', 'Bassel', 'Walid', 'Kassem', 'Alexander', 'Maher', 'Daniel', 'Mostafa', 'Nader', 'Hussein', 'Ali', 'Karim', 'Gabriel', 'Leonardo', 'Jad', 'Majed', 'Jihad', 'Ahmad', 'Omar'],
    lastNames: ['Maatouk', 'Haidar', 'Jradi', 'Shour', 'El Zein', 'Melki', 'Sabra', 'Kuri', 'Matar', 'Chaitou', 'Zein', 'Sisi', 'Darwich', 'Bitar', 'Khamis', 'Ayoub', 'Tneich', 'Farkouh', 'Nassar', 'Dhaini']
  },
  // 69: India
  69: {
    firstNames: ['Sunil', 'Lallianzuala', 'Sahal', 'Manvir', 'Liston', 'Anirudh', 'Subhasish', 'Sandesh', 'Gurpreet', 'Nikhil', 'Rahul', 'Anwar', 'Jeakson', 'Brandon', 'Naorem', 'Mehtab', 'Vikram', 'Amrinder', 'Lalengmawia', 'Mahesh'],
    lastNames: ['Chhetri', 'Chhangte', 'Abdul Samad', 'Singh', 'Colaco', 'Thapa', 'Bose', 'Jhingan', 'Sandhu', 'Poojary', 'Bheke', 'Ali', 'Fernandes', 'Ralte', 'Partap', 'Kotal', 'Wangjam', 'Mishra', 'Lalrinzuala', 'Gahlot']
  },
  // 70: Malaysia
  70: {
    firstNames: ['Arif', 'Faisal', 'Dion', 'Matthew', 'Endrick', 'Safawi', 'Dominic', 'Stuart', 'Syihan', 'La\'Vere', 'Daniel', 'Shahrul', 'Junior', 'Paulo', 'Romel', 'Noa', 'Akhyar', 'Azam', 'Syamer', 'Kugan'],
    lastNames: ['Aiman', 'Halim', 'Cools', 'Davies', 'Dos Santos', 'Rasid', 'Tan', 'Wilkin', 'Hazmi', 'Corbin-Ong', 'Ting', 'Saad', 'Eldstal', 'Josue', 'Morales', 'Laine', 'Rashid', 'Azmi', 'Kutty Abba', 'Kumar']
  },
  // 71: Indonesia
  71: {
    firstNames: ['Marselino', 'Rafael', 'Thom', 'Ragnar', 'Jay', 'Justin', 'Sandy', 'Ivar', 'Rizky', 'Asnawi', 'Pratama', 'Ernando', 'Shayne', 'Nathan', 'Mees', 'Eliano', 'Calvin', 'Egy', 'Witan', 'Hokky'],
    lastNames: ['Ferdinan', 'Struick', 'Haye', 'Oratmangoen', 'Idzes', 'Hubner', 'Walsh', 'Jenner', 'Ridho', 'Mangkualam', 'Arhan', 'Ari', 'Pattynama', 'Tjoe-A-On', 'Hilgers', 'Reijnders', 'Verdonk', 'Maulana Vikri', 'Sulaeman', 'Caraka']
  },
  // 72: Philippines
  72: {
    firstNames: ['Gerrit', 'Neil', 'Daisuke', 'Kevin', 'Jesse', 'Michael', 'Amani', 'John-Patrick', 'Santi', 'Jefferson', 'Patrick', 'Christian', 'Kenshiro', 'Sandro', 'Dylan', 'Javier', 'Paul', 'Zico', 'Adrian', 'Pocholo'],
    lastNames: ['Holtmann', 'Etheridge', 'Sato', 'Ingreso', 'Curran', 'Kempter', 'Aguinaldo', 'Strauss', 'Rublico', 'Tabinas', 'Deyto', 'Rontini', 'Daniels', 'Reyes', 'Demuynck', 'Gayoso', 'Bisonaya', 'Bailey', 'Ugelvik', 'Buggs']
  },
  // 73: Turkmenistan
  73: {
    firstNames: ['Arslanmyrat', 'Altymyrat', 'Elman', 'Meylis', 'Didar', 'Guvanch', 'Teymur', 'Begench', 'Batyr', 'Myrat', 'Rovshen', 'Dovran', 'Yhlas', 'Velmyrat', 'Ibraim', 'Serdar', 'Shohrat', 'Guychmyrat', 'Sanazar', 'Rasul'],
    lastNames: ['Amanov', 'Annadurdyyev', 'Tagayev', 'Diniyev', 'Durdyyev', 'Berdimyradov', 'Charyyev', 'Akmammedov', 'Babayan', 'Annaorazov', 'Hojayev', 'Toylyyev', 'Sapargulyyev', 'Ballakow', 'Mamedow', 'Geldiyew', 'Soyunow', 'Batyrow', 'Halmammedov', 'Titov']
  },
  // 74: Kuwait
  74: {
    firstNames: ['Shabaib', 'Fahad', 'Eid', 'Sultan', 'Reda', 'Khaled', 'Hamad', 'Mobarak', 'Sulaiman', 'Bandar', 'Bader', 'Mohammad', 'Meshari', 'Mahdi', 'Salman', 'Yousef', 'Ali', 'Abdulaziz', 'Fawaz', 'Talal'],
    lastNames: ['Al-Khaldi', 'Al-Hajeri', 'Al-Rashidi', 'Al-Enezi', 'Hani', 'Ebrahim', 'Al-Harbi', 'Al-Faneeni', 'Abdulghafour', 'Al-Salama', 'Al-Mutawa', 'Daham', 'Ghannam', 'Dashti', 'Bormeya', 'Nasser', 'Khalaf', 'Wadi', 'Ayedh', 'Fadel']
  },
  // 75: Yemen
  75: {
    firstNames: ['Abdulwasea', 'Ahmed', 'Nasser', 'Omar', 'Harwan', 'Mudir', 'Hamza', 'Mohammed', 'Emad', 'Ala\'a', 'Radhwan', 'Anis', 'Tareq', 'Galal', 'Wahid', 'Osamah', 'Abdullah', 'Qasim', 'Manaf', 'Ali'],
    lastNames: ['Al-Matari', 'Al-Sarori', 'Al-Gahwashi', 'Al-Dahi', 'Al-Zubaidi', 'Al-Radaei', 'Rawa', 'Al-Tairi', 'Khairalah', 'Al-Sasi', 'Al-Hubaishi', 'Al-Maari', 'Hizam', 'Al-Khadher', 'Al-Hemyari', 'Al-Sabahi', 'Al-Dharhani', 'Hanash', 'Saeed', 'Noman']
  },
  // 76: Singapore
  76: {
    firstNames: ['Ikhsan', 'Ilhan', 'Shawal', 'Hariss', 'Song', 'Safuwan', 'Glenn', 'Jacob', 'Hassan', 'Ryhan', 'Lionel', 'Shakir', 'Hami', 'Zulqarnaen', 'Amirul', 'Christopher', 'Farhan', 'Daniel', 'Farhan', 'Taufik'],
    lastNames: ['Fandi', 'Anuar', 'Harun', 'Ui-young', 'Baharudin', 'Kweh', 'Mahler', 'Sunny', 'Stewart', 'Tan', 'Hamzah', 'Syahin', 'Suzliman', 'Adli', 'van Huizen', 'Zulkifli', 'Goh', 'Suparno', 'Shahiran', 'Kumar']
  },
  // 77: Myanmar
  77: {
    firstNames: ['Maung Maung', 'Aung', 'Lwin Moe', 'Than Paing', 'Kyaw', 'David', 'Soe Moe', 'Hein Phyo', 'Nanda', 'Zaw', 'Myo', 'Yan', 'Wai', 'Zwe', 'Kaung', 'Thiha', 'Thet', 'Sithu', 'Hlaing', 'Nay'],
    lastNames: ['Lwin', 'Thu', 'Aung', 'Win', 'Zin', 'Htan', 'Kyaw', 'Phyo', 'Bo Bo', 'Mann', 'Naing', 'Lin', 'Htet', 'Khant', 'Zaw', 'Tun', 'Oo', 'Moe', 'Paing', 'Ko'],
    isLastNameFirst: true
  },
  // 78: Hong Kong
  78: {
    firstNames: ['Matt', 'Everton', 'Juninho', 'Shinichi', 'Tze-nam', 'Oliver', 'Helio', 'Jesse', 'Hung-fai', 'Ming-him', 'Chun-ming', 'Vas', 'Michael', 'Stefan', 'Leon', 'Max', 'Ka-wing', 'Tsz-ho', 'Ngan', 'Chun-ting'],
    lastNames: ['Orr', 'Camargo', 'Walter', 'Chan', 'Yue', 'Gerbig', 'Goncalves', 'Joy-yin', 'Yapp', 'Sun', 'Wu', 'Nunez', 'Udebuluzor', 'Pereira', 'Jones', 'Poon', 'Tse', 'Wong', 'Lok', 'Cheng']
  },
  // 79: Kyrgyzstan
  79: {
    firstNames: ['Joel', 'Valery', 'Beknaz', 'Gulzhigit', 'Odilzhon', 'Tamirlan', 'Aleksandr', 'Kayrat', 'Erzhan', 'Christian', 'Bakhtiyar', 'Suyuntbek', 'Kimi', 'Eldiyar', 'Nurlan', 'Murolimzhon', 'Mirlan', 'Arslan', 'Said', 'Amantur'],
    lastNames: ['Kojo', 'Kichin', 'Almazbekov', 'Alykulov', 'Abdurakhmanov', 'Kozubaev', 'Mishchenko', 'Zhyrgalbek uulu', 'Tokotaev', 'Brauzman', 'Duyshobekov', 'Mamyraliev', 'Merk', 'Zarypbekov', 'Sarykbaev', 'Akhmedov', 'Murzaev', 'Bekberdinov', 'Datsiev', 'Shamurzaev']
  },
  // 80: Cambodia
  80: {
    firstNames: ['Sieng', 'Lim', 'Nick', 'Thierry', 'Orn', 'Yudai', 'Kan', 'Soeuy', 'Keo', 'Sin', 'Taing', 'Min', 'Phan', 'Choun', 'Hul', 'Chea', 'Hav', 'Khoan', 'Sa', 'Sor'],
    lastNames: ['Chanthea', 'Pisoth', 'Taylor', 'Chantha Bin', 'Chanpolin', 'Ogawa', 'Mo', 'Visal', 'Soksela', 'Kakada', 'Crispino', 'Ratanak', 'Sopheak', 'Chanchav', 'Kimhuy', 'Vanneth', 'Soknet', 'Sobon', 'Ty', 'Rotana'],
    isLastNameFirst: true
  },
  // 81: Morocco
  81: {
    firstNames: ['Achraf', 'Hakim', 'Youssef', 'Sofyan', 'Azzedine', 'Brahim', 'Nayef', 'Yassine', 'Amine', 'Bilal', 'Noussair', 'Romain', 'Amir', 'Munir', 'Ayoub', 'Soufiane', 'Ilias', 'Abde', 'Chadi', 'Zakaria'],
    lastNames: ['Hakimi', 'Ziyech', 'En-Nesyri', 'Amrabat', 'Ounahi', 'Diaz', 'Aguerd', 'Bounou', 'Harit', 'El Khannouss', 'Mazraoui', 'Saiss', 'Adli', 'Richardson', 'El Kajoui', 'El Kaabi', 'Rahimi', 'Akhomach', 'Ezzalzouli', 'Riad']
  },
  // 82: Senegal
  82: {
    firstNames: ['Sadio', 'Kalidou', 'Nicolas', 'Pape', 'Idrissa', 'Edouard', 'Ismaila', 'Habib', 'Lamine', 'Krepin', 'Ismail', 'Iliman', 'Cheikhou', 'Moustapha', 'Abdoulaye', 'Formose', 'Pathe', 'Dion', 'Bamba', 'Seny'],
    lastNames: ['Mane', 'Koulibaly', 'Jackson', 'Gueye', 'Mendy', 'Sarr', 'Diallo', 'Camara', 'Diatta', 'Jakobs', 'Ndiaye', 'Kouyate', 'Name', 'Niakhate', 'Ciss', 'Lopy', 'Dieng', 'Gomis', 'Sow', 'Ballo-Toure']
  },
  // 83: Egypt
  83: {
    firstNames: ['Mohamed', 'Mahmoud', 'Omar', 'Mostafa', 'Marwan', 'Emam', 'Ahmed', 'Zizo', 'Hamdy', 'Yasser', 'Nasser', 'Osama', 'Akram', 'Ibrahim', 'Taher', 'Hussein', 'Kahraba', 'Tarek', 'Ramadan', 'Afsha'],
    lastNames: ['Salah', 'Trezeguet', 'Marmoush', 'Mohamed', 'Attia', 'Ashour', 'Sayed', 'Fathi', 'Hany', 'Elneny', 'Abdelmonem', 'Hegazi', 'Ibrahim', 'El Shenawy', 'Shobeir', 'Maher', 'Faisal', 'Tawfik', 'Adel', 'Sobhi']
  },
  // 84: Nigeria
  84: {
    firstNames: ['Victor', 'Ademola', 'Alex', 'Wilfred', 'Samuel', 'Kelechi', 'Calvin', 'Frank', 'William', 'Moses', 'Joe', 'Zaidu', 'Stanley', 'Semi', 'Bright', 'Chidozie', 'Raphael', 'Alhassan', 'Fisayo', 'Terem'],
    lastNames: ['Osimhen', 'Lookman', 'Iwobi', 'Ndidi', 'Chukwueze', 'Iheanacho', 'Bassey', 'Onyeka', 'Troost-Ekong', 'Boniface', 'Simon', 'Aribo', 'Sanusi', 'Nwabali', 'Ajayi', 'Osayi-Samuel', 'Awaziem', 'Onyedika', 'Yusuf', 'Moffi']
  },
  // 85: Ivory Coast
  85: {
    firstNames: ['Franck', 'Sebastien', 'Simon', 'Oumar', 'Nicolas', 'Ibrahim', 'Wilfried', 'Evan', 'Seko', 'Jeremie', 'Amad', 'Willy', 'Odilon', 'Ghislain', 'Yahia', 'Jean-Philippe', 'Christ', 'Evann', 'Ousmane', 'Badra'],
    lastNames: ['Kessie', 'Haller', 'Adingra', 'Diakite', 'Pepe', 'Sangare', 'Singo', 'Ndicka', 'Fofana', 'Boga', 'Diallo', 'Boly', 'Kossounou', 'Konan', 'Krasso', 'Inao', 'Guessand', 'Diomande', 'Ali Sangare', 'Aurier']
  },
  // 86: Cameroon
  86: {
    firstNames: ['Bryan', 'Andre-Frank', 'Vincent', 'Georges-Kevin', 'Andre', 'Christopher', 'Frank', 'Harold', 'Jean-Charles', 'Olivier', 'Darlin', 'Jackson', 'Carlos', 'Nouhou', 'Fabrice', 'Devis', 'Faris', 'Arthur', 'Ben', 'Boris'],
    lastNames: ['Mbeumo', 'Zambo Anguissa', 'Aboubakar', 'Nkoudou', 'Onana', 'Wooh', 'Magri', 'Moukoudi', 'Castelletto', 'Kemen', 'Yongwa', 'Tchatchoua', 'Baleba', 'Tolo', 'Ondoa', 'Epassy', 'Pemi Moumbagna', 'Avom', 'Elliott', 'Enow']
  },
  // 87: Algeria
  87: {
    firstNames: ['Riyad', 'Ismael', 'Amine', 'Rayan', 'Said', 'Baghdad', 'Youcef', 'Ramy', 'Houssem', 'Fares', 'Aissa', 'Adam', 'Anthony', 'Mohamed', 'Jaouen', 'Hichem', 'Ahmed', 'Yassine', 'Anis', 'Ramiz'],
    lastNames: ['Mahrez', 'Bennacer', 'Gouiri', 'Ait-Nouri', 'Benrahma', 'Bounedjah', 'Atal', 'Bensebaini', 'Aouar', 'Chaibi', 'Mandi', 'Ounas', 'Mandrea', 'Amoura', 'Hadjam', 'Boudaoui', 'Touba', 'Benzia', 'Hadj Moussa', 'Zerrouki']
  },
  // 88: Tunisia
  88: {
    firstNames: ['Ellyes', 'Youssef', 'Aissa', 'Hannibal', 'Montassar', 'Ali', 'Elias', 'Wajdi', 'Aymen', 'Mohamed', 'Yassine', 'Hamza', 'Nader', 'Seifeddine', 'Haythem', 'Bilel', 'Ghaith', 'Bechir', 'Mortadha', 'Ferjani'],
    lastNames: ['Skhiri', 'Msakni', 'Laidouni', 'Mejbri', 'Talbi', 'Abdi', 'Achouri', 'Kechrida', 'Dahmen', 'Ali Ben Romdhane', 'Meriah', 'Rafia', 'Ghandri', 'Jaziri', 'Jouini', 'Mejri', 'Maaloul', 'Zaalouni', 'Ben Said', 'Sassi']
  },
  // 89: Mali
  89: {
    firstNames: ['Yves', 'Amadou', 'Mohamed', 'Kamory', 'Hamari', 'Lassine', 'Falaye', 'Sekou', 'Aliou', 'Boubakar', 'Moussa', 'Abdoulaye', 'Mamadou', 'Dorgeles', 'Adama', 'Cheick', 'Fousseni', 'Djigui', 'Ismael', 'Ibrahima'],
    lastNames: ['Bissouma', 'Haidara', 'Camara', 'Doumbia', 'Traore', 'Sinayoko', 'Sacko', 'Koita', 'Diarra', 'Kouyate', 'Djenepo', 'Diaby', 'Fofana', 'Nene', 'Oumar Sissako', 'Diabate', 'Diawara', 'Sissoko', 'Samassekou', 'Niakate']
  },
  // 90: South Africa
  90: {
    firstNames: ['Percy', 'Teboho', 'Themba', 'Ronwen', 'Evidence', 'Aubrey', 'Khuliso', 'Sphephelo', 'Grant', 'Thapelo', 'Mothobi', 'Siyabonga', 'Oswin', 'Iqraam', 'Elias', 'Ricardo', 'Thalente', 'Sipho', 'Veli', 'Terrence'],
    lastNames: ['Tau', 'Mokoena', 'Zwane', 'Williams', 'Makgopa', 'Modiba', 'Mudau', 'Sithole', 'Kekana', 'Morena', 'Mvala', 'Ngezana', 'Appollis', 'Rayners', 'Mokwana', 'Goss', 'Mbatha', 'Chaine', 'Mothwa', 'Mashego']
  },
  // 91: Ghana
  91: {
    firstNames: ['Mohammed', 'Thomas', 'Inaki', 'Jordan', 'Antoine', 'Salis', 'Ernest', 'Alexander', 'Alidu', 'Tariq', 'Kamaldeen', 'Joseph', 'Abdul', 'Elisha', 'Lawrence', 'Gideon', 'Ebenezer', 'Jerome', 'Ibrahim', 'Majeed'],
    lastNames: ['Kudus', 'Partey', 'Williams', 'Ayew', 'Semenyo', 'Abdul Samed', 'Nuamah', 'Djiku', 'Seidu', 'Lamptey', 'Sulemana', 'Paintsil', 'Fatawu', 'Owusu', 'Ati-Zigi', 'Mensah', 'Annan', 'Opoku', 'Ashimeru', 'Kyereh']
  },
  // 93: Burkina Faso
  93: {
    firstNames: ['Edmond', 'Bertrand', 'Dango', 'Issa', 'Blati', 'Gustavo', 'Herve', 'Adamo', 'Nasser', 'Steeve', 'Cedric', 'Sacha', 'Hassane', 'Trova', 'Ismahila', 'Kilian', 'Valentin', 'Mohamed', 'Kouame', 'Stephane'],
    lastNames: ['Tapsoba', 'Traore', 'Ouattara', 'Kabore', 'Toure', 'Sangare', 'Koffi', 'Nagalo', 'Djiga', 'Yago', 'Badolo', 'Banse', 'Bande', 'Boni', 'Ouedraogo', 'Nikiema', 'Nouma', 'Kone', 'Botue', 'Aziz Ki']
  },
  // 94: Cape Verde
  94: {
    firstNames: ['Ryan', 'Garry', 'Bebe', 'Jamiro', 'Logan', 'Roberto', 'Kevin', 'Steven', 'Deroy', 'Patrick', 'Willy', 'Laros', 'Telmo', 'Wagner', 'Diney', 'Bryan', 'Vozinha', 'Marcio', 'Kelvin', 'Helio'],
    lastNames: ['Mendes', 'Rodrigues', 'Tiago', 'Monteiro', 'Costa', 'Lopes', 'Pina', 'Moreira', 'Duarte', 'Andrade', 'Semedo', 'Arcanjo', 'Borges', 'Teixeira', 'Dias', 'Rosa', 'Pires', 'Varela', 'Fernandes', 'Tavares']
  },
  // 95: Guinea
  95: {
    firstNames: ['Serhou', 'Naby', 'Mohamed', 'Aguibou', 'Mouctar', 'Issiaga', 'Saidou', 'Julian', 'Abdoulaye', 'Mory', 'Facinet', 'Amadou', 'Seydouba', 'Morlaye', 'Aliou', 'Ibrahima', 'Kaly', 'Sekou', 'Ibrahim', 'Ousmane'],
    lastNames: ['Guirassy', 'Keita', 'Bayo', 'Camara', 'Diakhaby', 'Sylla', 'Sow', 'Jeanvier', 'Toure', 'Diawara', 'Conte', 'Cisse', 'Balde', 'Sene', 'Diakite', 'Traore', 'Barry', 'Bangoura', 'Soumah', 'Diallo']
  },
  // 96: Gabon
  96: {
    firstNames: ['Pierre-Emerick', 'Denis', 'Mario', 'Aaron', 'Bruno', 'Jim', 'Alex', 'David', 'Shavy', 'Guelor', 'Anthony', 'Jacques', 'Loyce', 'Anse', 'Yrondu', 'Clech', 'Medwin', 'Jeremy', 'Urie-Michel', 'Teddy'],
    lastNames: ['Aubameyang', 'Bouanga', 'Lemina', 'Appindangoye', 'Ecuele Manga', 'Allevinah', 'Moucketou', 'Sambissa', 'Babicka', 'Kanga', 'Oyono', 'Ekomie', 'Mbaba', 'Ngoubi', 'Musavu-King', 'Loufilou', 'Biteghe', 'Mboula', 'Averlant', 'Biyogo Poko']
  },
  // 101: Benin
  101: {
    firstNames: ['Steve', 'Jodel', 'Andreas', 'Cedric', 'Junior', 'Mohamed', 'Saturnin', 'David', 'Olivier', 'Rachid', 'Tosin', 'Matteo', 'Dodo', 'Tamimou', 'Rodrigue', 'Prince', 'Imourane', 'Romaric', 'Mariano', 'Samson'],
    lastNames: ['Mounie', 'Dossou', 'Hountondji', 'Olaitan', 'Tijani', 'Allagbe', 'Kiki', 'Verdon', 'Moumini', 'Aiyegun', 'Ahlinvi', 'Dokou', 'Ouorou', 'Fassinou', 'Danko', 'Hassane', 'Amoussou', 'Ahouangbo', 'Akinyemi', 'Sessegnon']
  }
};
