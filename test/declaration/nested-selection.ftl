cookies = I have baked { $count ->
   [one] one cookie, if you eat it there will be zero left
  *[other] On { $day ->
     [monday] Monday
    *[other] Next week
   } you will get more cookies
}