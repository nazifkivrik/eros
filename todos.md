1. Search sayfasında infinite scroll çalışmıyor sadece ilk sonuçlar gösteriliyor.

2. Scene detail page te klasör detayları gösterilmiyor( oluşturulan .nfo,poster,indirilen dosya gibi )

3. Unsub durumunda torrent istemcisinden silmiyor .

4. Downloads sayfasında şema hataları var docker.("url": "/api/download-queue/unified" )

5. Metasız scenelerin folderlar oluşturulurken Unknown altında oluşturuluyor direk scene ismi ile oşuturulmalı.

6. Bir perfomer sildikten sonra isteğe bağlı scenelerde silebiliyoruz fakat sonrasında aynı performerı tekrar ekeldğimde de status direk downloading olarak geldi demekki databasede bazı kayıtlar silinmemiş. Mantık şöyle performer sildik ilişkili sceneleride sil dedik başka relationu olmayan (studyo ilede de ilişkisi olabilir) bütün sceneler silinir studyoya relation varsa relation silinir. 

7. Metadata refresh jobu hem unsub olanların folderları oluşturuyor hemde duplicate folderlar oluşturuyor.

8. Hash generation tamamen gereksiz olmuş bu yanlış anlaşılma sonucu oluşturulmuş bir job. Hash kontrolü tpdb deki duplicate sitelerin ayrışması için istemiştim fakat böyle bir kod oluşturuldu bunu kaldıralım.Tpdbden performers scenes gelirken "hashes": [
        {
          "can_delete": true,
          "created_at": "2022-11-08T23:08:36+00:00",
          "duration": 0,
          "hash": "string",
          "id": 0,
          "scene_id": 0,
          "submissions": 0,
          "type": "OSHASH",
          "updated_at": "2022-11-08T23:08:36+00:00",
          "users": [
            0
          ]
        }
      ] bu formatta hashler geliyor bunları karşılaştırarak deduplicate yapacağız sceneleri. 

9. 