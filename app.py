import streamlit as st
import pandas as pd
from PIL import Image

# Initialize session state for rounds and scores
if 'rounds' not in st.session_state:
    st.session_state.rounds = []

if 'players' not in st.session_state:
    st.session_state.players = []

if 'step' not in st.session_state:
    st.session_state.step = 1
    
# Title
st.title("Mahjong score app")

# # DEBUG
# st.session_state.step = 2
# st.session_state.players = ["Aiko", "Minke", "Peter", "Marjo"]

# Step 1: Input player names
if st.session_state.step == 1:
    st.write("### In welke volgorde zitten we?")
    
    options = ["Aiko", "Marjo", "Minke", "Peter"]
    
    # Create 3 columns
    col1, col2, col3 = st.columns([1, 1, 1])  # Adjust the width of the columns if needed

    # Player 1 selectbox in the top-left corner (col1)
    with col1:
        name_1 = st.selectbox("Speler 1", options)
        if name_1:
            options.remove(name_1)

    # Player 2 selectbox in the top-right corner (col3)
    with col3:
        name_2 = st.selectbox("Speler 2", options)
        if name_2:
            options.remove(name_2)

    # Create the second row with 3 columns (centered image in the middle)
    col4, col5, col6 = st.columns([1, 1, 1])
    col7, col8, col9 = st.columns([1, 1, 1])

    # Player 3 selectbox in the bottom-left corner (col4)
    with col7:
        name_3 = st.selectbox("Speler 3", options)
        if name_3:
            options.remove(name_3)

    # Player 4 selectbox in the bottom-right corner (col6)
    with col9:
        name_4 = st.selectbox("Speler 4", options)

    # Image in the center
    with col5:
        # Replace with the path to your image
        image = Image.open('top-view2.jpg')  # Adjust image path
        st.image(image, use_container_width=True)


    st.session_state.players = [name_1, name_2, name_3, name_4]
    if st.button("Begin met spelen"):
        st.session_state.step = 2
        st.session_state.rounds = []
        # st.session_state.players = [name_1, name_2, name_3, name_4]
        st.rerun()

else:
    st.write("### Nieuwe ronde")

    # Add new round
    if st.session_state.players:
        with st.form("new_round_form"):
            col1, col2 = st.columns([1, 1])
            with col1:
                mahjong_player = st.selectbox("Speler met Mahjong", st.session_state.players)
            with col2:
                eastern_wind = st.selectbox("Oosten wind", st.session_state.players)
            scores = {}
            for player in st.session_state.players:
                scores[player] = st.number_input(f"Score for {player}", value=0, step=1)
            submitted = st.form_submit_button("Voeg ronde toe")

            if submitted:
                round_data = {"Round": str(len(st.session_state.rounds) + 1), "Mahjong player": mahjong_player, "Eastern Wind": eastern_wind, **scores}
                st.session_state.rounds.append(round_data)
                # st.success("Round added!")
                st.rerun()



    # Display all rounds in a single table
    if st.session_state.rounds:
        st.write("### Punten")
        rounds_df = pd.DataFrame(st.session_state.rounds)
        rounds_df.set_index("Round", inplace=True)
        pays_and_receives = pd.DataFrame(columns=["Mahjong", "East", st.session_state.players[0], st.session_state.players[1], st.session_state.players[2], st.session_state.players[3]])
        
        for idx, round_data in rounds_df.iterrows():
            round_dict = {}
            east_player = round_data["Eastern Wind"]
            mahjong_player = round_data["Mahjong player"]
            # print(f"\n\nnew round: ----------------------")
            # print(f"East player: {round_data["Eastern Wind"]}")
            # print(f"Mahjong player: {round_data["Mahjong player"]}") 
            for player in st.session_state.players:
                # print(f"\ncalculation for {player}:")
                # print(f"{player} has {round_data[player]} points")
                # if player == mahjong_player:
                    # print(f"{player} is the Mahjong player")
                # if player == east_player:
                    # print(f"{player} is the East player")
                receives = 0
                pays = 0

                ####### RECEVING POINTS #########
                for other_player in st.session_state.players:
                    
                    if player == other_player:
                        # skip the player itself
                        continue
                    else:
                        # receiving points from all players except the mahjong player
                        if other_player != mahjong_player:
                            
                            if player == east_player:
                                # print(f"   {player} receives {player}'s score from {other_player} double because Eastern Wind: {round_data[player]*2}")
                                receives += round_data[player]*2
                            else:
                                # print(f"   {player} receives {player}'s score from {other_player}: {round_data[player]}")
                                receives += round_data[player]


                ####### PAYING POINTS #########
                for other_player in st.session_state.players:
                    
                    if player == other_player:
                        # skip the player itself
                        continue
                    else:
                        if player == mahjong_player:
                            # if the current player is mahjong, he doesnt have to pay
                            continue
                        
                        # if the current player is not mahjong, he will pay to all other players, and double for east
                        if other_player == east_player:
                            # print(f"   {player} pays {other_player}'s score to {other_player} double because Eastern Wind: {round_data[other_player]*2}")
                            pays += round_data[other_player]*2
                        else:
                            # print(f"   {player} pays {other_player}'s score to {other_player}: {round_data[other_player]}")
                            pays += round_data[other_player]
                round_dict[player] = f" + {receives} | - {pays} "
            round_dict["Mahjong"] = round_data["Mahjong player"]
            round_dict["East"] = round_data["Eastern Wind"]
            round_dict["Round"] = str(idx)
            pays_and_receives.loc[idx] = round_dict
        
        # Count total scores
        totals_dict = {}
        for player in st.session_state.players:
            receives = pays_and_receives[player].str.extractall(r"\+ (\d+)").astype(int).sum().sum()
            pays = pays_and_receives[player].str.extractall(r"- (\d+)").astype(int).sum().sum()
            totals_dict[player] = str(receives - pays)

        totals_dict["Mahjong"] = ""
        totals_dict["East"] = ""
        totals_dict["Round"] = "Totals"
        pays_and_receives.loc["Totals"] = totals_dict
        pays_and_receives = pays_and_receives.apply(lambda x: x.astype(str))
        st.dataframe(pays_and_receives, use_container_width=True)

    # Edit existing round
    if st.session_state.rounds:
        st.write("### Wijzig ronde")
        round_options = [f"Ronde {i + 1}" for i in range(len(st.session_state.rounds))]
        round_to_edit = st.selectbox("Wlke ronde wil je wijzigen?", round_options)

        round_idx = int(round_to_edit.split()[-1]) - 1  # Get the round index
        round_data = st.session_state.rounds[round_idx]

        with st.form(f"edit_round_form_{round_idx}"):
            col1, col2 = st.columns([1, 1])
            with col1:
                mahjong_player = st.selectbox("Mahjong Player", st.session_state.players, index=st.session_state.players.index(round_data["Mahjong player"]))
            with col2:
                eastern_wind = st.selectbox("Eastern Wind Player", st.session_state.players, index=st.session_state.players.index(round_data["Eastern Wind"]))
            scores = {}
            for player in st.session_state.players:
                scores[player] = st.number_input(f"Score for {player}", value=round_data.get(player, 0), step=1)

            submit_edit = st.form_submit_button("Save Changes")
            
            if submit_edit:
                round_data["Mahjong player"] = mahjong_player
                round_data["Eastern Wind"] = eastern_wind
                for player in st.session_state.players:
                    round_data[player] = scores[player]

                # Update the round data in session state
                st.session_state.rounds[round_idx] = round_data
                st.success("Round updated!")
                st.rerun()



    if st.button("Nieuwe pot?"):
        st.session_state.step = 1
        st.session_state.players = []
        st.session_state.rounds = []
        st.rerun()
























exit()




import streamlit as st
import pandas as pd

# Initialize session state for rounds and scores
if 'rounds' not in st.session_state:
    st.session_state.rounds = []

if 'players' not in st.session_state:
    st.session_state.players = []

if 'step' not in st.session_state:
    st.session_state.step = 1

# Title
st.title("Mahjong Scoring App")

# DEBUG
st.session_state.step = 2
st.session_state.players = ["Aiko", "Minke", "Peter", "Marjo"]

# Step 1: Input player names
if st.session_state.step == 1:
    st.write("## Step 1: Enter Player Names")
    num_players = 4
    for i in range(num_players):
        name = st.text_input(f"Player {i + 1} Name")
        if name and name not in st.session_state.players:
            st.session_state.players.append(name)

    if len(st.session_state.players) == num_players:
        if st.button("Next Step"):
            st.session_state.step = 2

# Step 2: Add scores per round
elif st.session_state.step == 2:
    st.write("## Step 2: Add Scores for a New Round")
    if st.session_state.players:
        with st.form("new_round_form"):
            mahjong_player = st.selectbox("Mahjong Player", st.session_state.players)
            eastern_wind = st.selectbox("Eastern Wind Player", st.session_state.players)
            scores = {}
            for player in st.session_state.players:
                scores[player] = st.number_input(f"Score for {player}", value=0, step=1)
            submitted = st.form_submit_button("Add Round")

            if submitted:
                round_data = {"Round": str(len(st.session_state.rounds) + 1), "Mahjong player": mahjong_player, "Eastern Wind": eastern_wind, **scores}
                st.session_state.rounds.append(round_data)
                st.success("Round added!")

    # Display all rounds in a single table
    if st.session_state.rounds:
        st.write("## Scoring Rounds")
        rounds_df = pd.DataFrame(st.session_state.rounds)
        rounds_df.set_index("Round", inplace=True)
        pays_and_receives = pd.DataFrame(columns=["Mahjong", "East", st.session_state.players[0], st.session_state.players[1], st.session_state.players[2], st.session_state.players[3]])
        
        for idx, round_data in rounds_df.iterrows():
            round_dict = {}
            east_player = round_data["Eastern Wind"]
            mahjong_player = round_data["Mahjong player"]
            # print(f"\n\nnew round: ----------------------")
            # print(f"East player: {round_data["Eastern Wind"]}")
            # print(f"Mahjong player: {round_data["Mahjong player"]}") 
            for player in st.session_state.players:
                # print(f"\ncalculation for {player}:")
                # print(f"{player} has {round_data[player]} points")
                # if player == mahjong_player:
                    # print(f"{player} is the Mahjong player")
                # if player == east_player:
                    # print(f"{player} is the East player")
                receives = 0
                pays = 0



                ####### RECEVING POINTS #########
                for other_player in st.session_state.players:
                    
                    if player == other_player:
                        # skip the player itself
                        continue
                    else:
                        # receiving points from all players except the mahjong player
                        if other_player != mahjong_player:
                            
                            if player == east_player:
                                # print(f"   {player} receives {player}'s score from {other_player} double because Eastern Wind: {round_data[player]*2}")
                                receives += round_data[player]*2
                            else:
                                # print(f"   {player} receives {player}'s score from {other_player}: {round_data[player]}")
                                receives += round_data[player]


                ####### PAYING POINTS #########
                for other_player in st.session_state.players:
                    
                    if player == other_player:
                        # skip the player itself
                        continue
                    else:
                        if player == mahjong_player:
                            # if the current player is mahjong, he doesnt have to pay
                            continue
                        
                        # if the current player is not mahjong, he will pay to all other players, and double for east
                        if other_player == east_player:
                            # print(f"   {player} pays {other_player}'s score to {other_player} double because Eastern Wind: {round_data[other_player]*2}")
                            pays += round_data[other_player]*2
                        else:
                            # print(f"   {player} pays {other_player}'s score to {other_player}: {round_data[other_player]}")
                            pays += round_data[other_player]
                round_dict[player] = f" + {receives} | - {pays} "
            round_dict["Mahjong"] = round_data["Mahjong player"]
            round_dict["East"] = round_data["Eastern Wind"]
            round_dict["Round"] = str(idx)
            pays_and_receives.loc[idx] = round_dict
        
        # Count total scores
        totals_dict = {}
        for player in st.session_state.players:
            receives = pays_and_receives[player].str.extractall(r"\+ (\d+)").astype(int).sum().sum()
            pays = pays_and_receives[player].str.extractall(r"- (\d+)").astype(int).sum().sum()
            totals_dict[player] = str(receives - pays)

        # Add additional values for Mahjong, East, and Round
        totals_dict["Mahjong"] = "-"
        totals_dict["East"] = "-"
        totals_dict["Round"] = "Totals"

        # Insert the totals row into the DataFrame
        pays_and_receives.loc["Totals"] = totals_dict

        # Convert all values to strings for display
        pays_and_receives = pays_and_receives.apply(lambda x: x.astype(str))

        # Render the styled DataFrame with merged cells visually for totals row
        st.write(pays_and_receives)


    if st.button("Restart"):
        st.session_state.step = 1
        st.session_state.players = []
        st.session_state.rounds = []
