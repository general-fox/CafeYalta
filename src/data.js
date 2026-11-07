export const categories = [
  { id: 'breakfast', name: 'Завтраки' }, { id: 'salads', name: 'Салаты и закуски' }, { id: 'soups', name: 'Супы' }, { id: 'hot', name: 'Горячее' }, { id: 'bakery', name: 'Выпечка' }, { id: 'dessert', name: 'Десерты' }, { id: 'drinks', name: 'Напитки' },
];

// Демонстрационное меню. Цены, вес, состав и аллергены нужно заменить
// подтверждёнными данными ресторана при подключении iiko.
export const products = [
  { id: 'b1', category: 'breakfast', name: 'Сырники со сметаной', description: 'Румяные творожные сырники, сметана и ягодный джем', price: 490, weight: '220 г', image: 'generated/menu/b1.jpg', tag: 'Любимое', allergens: 'Молоко, яйца, глютен' },
  { id: 'b2', category: 'breakfast', name: 'Мацони с мёдом и орехами', description: 'Нежный кисломолочный мацони, цветочный мёд и грецкие орехи', price: 290, weight: '200 г', image: 'generated/menu/b2.jpg', tag: 'Лёгкое утро', allergens: 'Молоко, орехи, мёд' },
  { id: 's1', category: 'salads', name: 'Овощной салат с орехами', description: 'Спелые томаты, огурцы, свежая зелень и грецкие орехи', price: 570, weight: '270 г', image: 'generated/menu/s1.jpg', tag: 'Лёгкий выбор', allergens: 'Орехи' },
  { id: 's2', category: 'salads', name: 'Цезарь с курицей', description: 'Курица, хрустящие листья салата, сухарики и сыр сулугуни', price: 690, weight: '260 г', image: 'generated/menu/s2.jpg', allergens: 'Молоко, яйца, глютен, горчица, рыба' },
  { id: 's3', category: 'salads', name: 'Салат с креветками и кальмаром', description: 'Креветки и командорский кальмар со свежими овощами и зеленью', price: 790, weight: '240 г', image: 'generated/menu/s3.jpg', allergens: 'Ракообразные, моллюски' },
  { id: 's4', category: 'salads', name: 'Буррата с томатами', description: 'Сливочная буррата, сочные томаты и тёплый грузинский лаваш', price: 890, weight: '280 г', image: 'generated/menu/s4.jpg', allergens: 'Молоко, глютен' },
  { id: 'soup1', category: 'soups', name: 'Домашний борщ', description: 'Наваристый борщ с говядиной, сметаной и свежей зеленью', price: 550, weight: '350 г', image: 'generated/menu/soup1.jpg', allergens: 'Молоко, сельдерей' },
  { id: 'soup2', category: 'soups', name: 'Крем-суп из тыквы', description: 'Бархатистая тыква, сливки и тыквенные семечки', price: 450, weight: '300 г', image: 'generated/menu/soup2.jpg', allergens: 'Молоко' },
  { id: 'h1', category: 'hot', name: 'Куриные котлеты', description: 'Нежные домашние котлеты со сливочным грибным соусом', price: 690, weight: '300 г', image: 'generated/menu/h1.jpg', tag: 'Как дома', allergens: 'Молоко, яйца, глютен' },
  { id: 'soup3', category: 'soups', name: 'Куриный суп с лапшой', description: 'Золотистый куриный бульон, домашняя лапша и зелень', price: 450, weight: '350 г', image: 'generated/menu/soup3.jpg', allergens: 'Яйца, глютен, сельдерей' },
  { id: 'h2', category: 'hot', name: 'Говяжьи щёчки с пюре', description: 'Томлёные говяжьи щёчки и нежное картофельное пюре', price: 990, weight: '330 г', image: 'generated/menu/h2.jpg', allergens: 'Молоко, сельдерей' },
  { id: 'h3', category: 'hot', name: 'Дорадо с молодым картофелем', description: 'Запечённая дорадо, молодой картофель и гранатовый соус наршараб', price: 1190, weight: '380 г', image: 'generated/menu/h3.jpg', tag: 'Вкус юга', allergens: 'Рыба' },
  { id: 'h4', category: 'hot', name: 'Креветки чкмерули', description: 'Креветки в ароматном сливочном соусе с чесноком', price: 890, weight: '260 г', image: 'generated/menu/h4.jpg', allergens: 'Ракообразные, молоко' },
  { id: 'h5', category: 'hot', name: 'Хинкали традиционные', description: 'Тонкое тесто, сочная мясная начинка, бульон и пряные травы', price: 490, weight: '4 шт. / 320 г', image: 'generated/menu/h5.jpg', allergens: 'Глютен' },
  { id: 'p1', category: 'bakery', name: 'Хачапури по-аджарски', description: 'Румяная лодочка с расплавленным сыром, яйцом и сливочным маслом', price: 650, weight: '350 г', image: 'generated/menu/p1.jpg', tag: 'Из печи', allergens: 'Глютен, молоко, яйца' },
  { id: 'd1', category: 'dessert', name: 'Медовик', description: 'Тонкие медовые коржи и нежный сметанный крем', price: 390, weight: '140 г', image: 'generated/menu/d1.jpg', allergens: 'Молоко, яйца, глютен, мёд' },
  { id: 'd2', category: 'dessert', name: 'Наполеон', description: 'Хрустящие слои теста с воздушным заварным кремом', price: 450, weight: '160 г', image: 'generated/menu/d2.jpg', allergens: 'Молоко, яйца, глютен' },
  { id: 'dr1', category: 'drinks', name: 'Грушевый лимонад', description: 'Освежающий лимонад со вкусом спелой груши', price: 290, weight: '500 мл', image: 'generated/menu/dr1.jpg', allergens: 'Уточните состав у ресторана' },
  { id: 'dr2', category: 'drinks', name: 'Морс клюква — гибискус', description: 'Насыщенный клюквенный морс с цветочными нотами гибискуса', price: 490, weight: '1 л', image: 'generated/menu/dr2.jpg', allergens: 'Уточните состав у ресторана' },
  { id: 'dr3', category: 'drinks', name: 'Апельсиновый сок', description: 'Яркий цитрусовый вкус к завтраку или любимому блюду', price: 260, weight: '250 мл', image: 'generated/menu/dr3.jpg', allergens: 'Уточните состав у ресторана' },
];
