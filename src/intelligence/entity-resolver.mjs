function norm(value) { return String(value ?? '').toLowerCase().normalize('NFKC').replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
function num(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function phoneKey(value) { return String(value ?? '').replace(/\D/g, '').replace(/^20/, '').replace(/^0/, ''); }
function similarity(a,b){const aa=norm(a),bb=norm(b);if(!aa||!bb)return 0;if(aa===bb)return 1;if(aa.includes(bb)||bb.includes(aa))return .88;const as=new Set(aa.split(' ')),bs=new Set(bb.split(' '));return [...as].filter(x=>bs.has(x)).length/Math.max(as.size,bs.size)}
function relativeDifference(a,b){const aa=num(a),bb=num(b);if(aa==null||bb==null)return null;return Math.abs(aa-bb)/Math.max(Math.abs(aa),Math.abs(bb),1)}
export function scorePropertyMatch(a,b){const reasons=[];let score=0;const typeA=norm(a?.property_type??a?.type),typeB=norm(b?.property_type??b?.type),txA=norm(a?.transaction_type??a?.transaction),txB=norm(b?.transaction_type??b?.transaction),cityA=norm(a?.city),cityB=norm(b?.city),districtA=norm(a?.district),districtB=norm(b?.district),parcelA=num(a?.parcel_number),parcelB=num(b?.parcel_number),pa=phoneKey(a?.phone??a?.primary_phone),pb=phoneKey(b?.phone??b?.primary_phone);
  if(pa&&pb&&pa===pb&&cityA&&cityA===cityB)return{score:1,reasons:['same_phone','same_city']};
  if(pa&&pb&&pa===pb){score+=.55;reasons.push('same_phone')}
  if(parcelA!=null&&parcelB!=null&&parcelA===parcelB&&cityA&&cityA===cityB&&typeA&&typeA===typeB){score+=.70;reasons.push('same_parcel_city_type')}
  const areaDiff=relativeDifference(a?.area_m2,b?.area_m2);if(areaDiff!=null&&areaDiff<=.01){score+=.15;reasons.push('same_area')}else if(areaDiff!=null&&areaDiff<=.03){score+=.08;reasons.push('near_area')}
  const priceDiff=relativeDifference(a?.price,b?.price);if(priceDiff!=null&&priceDiff<=.02){score+=.10;reasons.push('same_price')}else if(priceDiff!=null&&priceDiff<=.05){score+=.05;reasons.push('near_price')}
  if(cityA&&cityB&&cityA===cityB){score+=.05;reasons.push('same_city')}if(districtA&&districtB&&districtA===districtB){score+=.08;reasons.push('same_district')}if(typeA&&typeB&&typeA===typeB){score+=.05;reasons.push('same_property_type')}if(txA&&txB&&txA===txB){score+=.05;reasons.push('same_transaction_type')}
  if(similarity(a?.address,b?.address)>=.85){score+=.12;reasons.push('same_address')}if(similarity(a?.name,b?.name)>=.9){score+=.05;reasons.push('same_name')}
  return{score:Math.min(score,1),reasons}
}
export function chooseCanonical(candidates){return[...candidates].sort((a,b)=>{const s=Number(b?.confidence??0)-Number(a?.confidence??0);if(s!==0)return s;const ca=Object.values(a??{}).filter(v=>v!==null&&v!==undefined&&v!=='').length,cb=Object.values(b??{}).filter(v=>v!==null&&v!==undefined&&v!=='').length;if(cb!==ca)return cb-ca;return String(a?.source_url??'').localeCompare(String(b?.source_url??''))})[0]??null}
