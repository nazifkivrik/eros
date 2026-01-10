1. /subscriptions sayfasında includeMetalessScenes filtresi  ve show unsubscribed seçenekleri çalışmıyor.  **fixed**

2. /subscriptions/:id sayfasında performera ait unsub edilmiş bir scene i resub yapamıyorum aynı şekilde unsubta yapamıyorum. **fixed**

3. /subscriptions sayfasındaki scene subscription butonu silmek yerine toggle yapıyor (unsubscribe/resubscribe). **fixed**
   - Active scene: X butonu (unsubscribe → isSubscribed: false)
   - Inactive scene: ✓ butonu (resubscribe → isSubscribed: true)
   - Subscription DB'den silinmiyor, sadece isSubscribed değişiyor

3. Metasız sceneler düzgün silinmiyor issues - **fixed**
   - ÖNCES: Name matching çok katıydı, sadece junction table'daki ve title'da performer/studio adı geçen metasız sceneler siliniyordu
   - ŞİMDİ: Subscription tablosunu doğrudan sorguluyor, daha esnek name matching kullanıyor

4. Metasız sceneleri otomatik olarak inaktif başlıyor halbuki onlarında indirilmesi gerekiyor . **denenmedi henüz**

5. /subscriptions/:id sayfasında  hem subscription sütununda hemde download status alanında downloading çıkıyor sadece downloads status klonunda çıkması yeterli. **ok**

6. Torrent monitor jobunda torrent indirmesi bittikten sonra kendi klasörüne taşıma logici kontrol et , folderda move yapmayacağız bunun yerine torrent istemcisinde indirme yolunu ilgili klasör yapacağız böylece taşıma işlemini torrent istemcisi yapacak ve settings uida belirlediğimiz süre sonra torrent clienttan silecek. **denenmedi henüz**



