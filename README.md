TamperMonkey user script

-- Download ACSM files from eReolen.dk-0.1.user.js
    
    Used to download ACSM files from ebooks lend on eReolen.dk
    ACSM files are supported by Adobe Digital Editions

-- Aula.dk Vikar-statistik-3.0-user.js
    
    Adds a menu option to the default menu on aula.dk (after login)
    Clicking on the menu and the script will gather statistics about subsitution lessions and displays this as on overlay on the site
    The data gathering process takes a few seconds per child, so have a bit of patience.

    Format:
    Barn 	Måned 	    Lektioner 	Vikar 	%
    Navn 	2025-08 	109 	    21 	    19.27
    Navn	2025-09 	141 	    18 	    12.77
    Navn 	2025-10 	115 	    12 	    10.43
    Navn	2025-11 	128 	    9 	    7.03
    Navn 	2025-12 	96 	        8 	    8.33
    Navn 	2026-01 	128 	    0 	    0

    Barn = The child's name
    Måned = Month of the data
    Lektioner = Number of lessions this month
    Virkar = Number of lessions where a subsitute teacher were used
    % = The percentage of lessions this month that were subsituted by another teacher
