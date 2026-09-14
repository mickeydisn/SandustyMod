SO YOU SEE THAT YOU STUCTURE ARE CRAPY .. I WANT TREE NOT this littel think .. the Celurar automation approche is write .. but you dont manage the node , the growing of node , the distance from the racine etc .. 



# Donc on va le refaire : 



## Les differente celules : 

- Branch : Cellue du core de l'arbre, parcourue par les energie
- BranchThickness : Cellue d'epesseur des branches
- Node : Cellue qui separe le flux n'énergie ( centre du noeud )
- NodeThickness : Cellue autour d'un Node

- Energie Possitive: Des racines jusqu'a au pointe , traverse l'abre , le fais pousé .. 
- Energie Negative: des pointe vert la racine : le fais grossir , le fais grandir 

### L'energie Possitive : 
  - Can Move: Va toujour de la racine vert le bout des branche. 
  - A une capaciter d'energi au depars, cosome quand elle bouge en fonction de la celule ou elle passe.
  
  Data : 
    - energy
    - distanceFromRacine
    - distanceFromLastNode
    - nNodeVisited
    - ... 

  - Quand elle arrive a bout d'une branche , elle ce transforme an Energi Negative.

### L'energie Negative : 
  - Can Move: Va toujour de la racine vert le bout des branche. 
  - Cette particule a la meme data que l'energie Possitive, mais fonction un peux differament. 
  - elle va consomer beaucoup moin d'energi pour ce deplacer que la positive. 
  - l'idée c'est quelle apport le surplus d'energi pour faire grossir la plante. 
  - Elle va la deposer la ou il y en a besoin et disparatre dans les racines sinon. ( le besoin c'est le grow de la cellule.)


### Branch
  - 

  Data : 
   - Distance : FromRacine, FromNode, CountNode
   - Limit : DistFromNode, DistFromRacine, Grow, Energi, 
   - Road - direction of elements: Vector
   - 

## Node
  Data : 
   - Distance : FromRacine, FromNode, CountNode
   - Limit : DistFromNode, DistFromRacine, Grow, Energi, 
   - Roads - direction of elements: Vector[]
   - 


### BranchThickness


## NodeThickness