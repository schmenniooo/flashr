import SwiftUI

struct CollectionsView: View {
    var body: some View {
        ZStack {
            Color.flashrBg.ignoresSafeArea()
            Text("Collections")
                .font(.flashrH1)
                .foregroundStyle(Color.flashrText)
        }
        .navigationTitle("Collections")
    }
}
